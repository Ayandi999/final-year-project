import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { query } from '../utils/db';

const authRouter = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'silent_voice_access_secret_123';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'silent_voice_refresh_secret_456';

// POST /app/auth/google-login
authRouter.post('/google-login', async (req, res): Promise<any> => {
  const { credential, profile } = req.body;

  let googleId = '';
  let email = '';
  let displayName = '';
  let avatarUrl = '';

  try {
    // 1. Verify Google ID Token if client ID is configured and credentials provided
    if (GOOGLE_CLIENT_ID && credential) {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (payload) {
        googleId = payload.sub;
        email = payload.email || '';
        displayName = payload.name || '';
        avatarUrl = payload.picture || '';
      }
    }

    // 2. Fallback to client-side payload if token verification was bypassed or offline testing is active
    if (!googleId && profile) {
      googleId = profile.googleId;
      email = profile.email;
      displayName = profile.displayName || profile.name || '';
      avatarUrl = profile.avatarUrl || profile.picture || '';
    }

    if (!googleId || !email) {
      return res.status(400).json({ success: false, message: 'Google authentication details missing or invalid.' });
    }

    // 3. Find or create the user record in Supabase PostgreSQL
    let userResult = await query('SELECT * FROM users WHERE google_id = $1', [googleId]);
    let user = userResult.rows[0];

    if (!user) {
      const insertResult = await query(
        `INSERT INTO users (google_id, email, display_name, avatar_url)
         VALUES ($1, $2, $3, $4)
         RETURNING *;`,
        [googleId, email, displayName, avatarUrl]
      );
      user = insertResult.rows[0];
      console.log(`[AUTH] Created new database user record for: ${email}`);
    } else {
      const updateResult = await query(
        `UPDATE users
         SET display_name = $1, avatar_url = $2, updated_at = CURRENT_TIMESTAMP
         WHERE google_id = $3
         RETURNING *;`,
        [displayName, avatarUrl, googleId]
      );
      user = updateResult.rows[0];
      console.log(`[AUTH] Updated profile info for user: ${email}`);
    }

    // 4. Generate access and refresh tokens
    const accessToken = jwt.sign(
      { googleId: user.google_id, email: user.email },
      JWT_ACCESS_SECRET,
      { expiresIn: '7d' } // Access token expires in 7 days
    );

    const refreshToken = jwt.sign(
      { googleId: user.google_id, id: user.id, email: user.email },
      JWT_REFRESH_SECRET,
      { expiresIn: '30d' } // Refresh token expires in 30 days (1 month)
    );

    // 5. Store JWT tokens in secure, HTTP-only cookies
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      user: {
        id: user.id,
        googleId: user.google_id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
      },
    });
  } catch (error) {
    console.error('[AUTH ERROR] Google login execution failed:', error);
    return res.status(500).json({ success: false, message: 'Google authentication handler failed.' });
  }
});

// POST /app/auth/google-callback (OAuth2 code authorization exchange)
authRouter.post('/google-callback', async (req, res): Promise<any> => {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ success: false, message: 'Authorization code is missing.' });
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await googleClient.getToken({
      code,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173', // Must match whitelisted frontend origin in Google Cloud console
    });

    const idToken = tokenResponse.tokens.id_token;
    if (!idToken) {
      throw new Error('No identity token returned from Google.');
    }

    // Verify ID token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Invalid token payload received.');
    }

    const googleId = payload.sub;
    const email = payload.email || '';
    const displayName = payload.name || '';
    const avatarUrl = payload.picture || '';

    // Find or create the user record
    let userResult = await query('SELECT * FROM users WHERE google_id = $1', [googleId]);
    let user = userResult.rows[0];

    if (!user) {
      const insertResult = await query(
        `INSERT INTO users (google_id, email, display_name, avatar_url)
         VALUES ($1, $2, $3, $4)
         RETURNING *;`,
        [googleId, email, displayName, avatarUrl]
      );
      user = insertResult.rows[0];
      console.log(`[AUTH] Created new database user record via OAuth redirect for: ${email}`);
    } else {
      const updateResult = await query(
        `UPDATE users
         SET display_name = $1, avatar_url = $2, updated_at = CURRENT_TIMESTAMP
         WHERE google_id = $3
         RETURNING *;`,
        [displayName, avatarUrl, googleId]
      );
      user = updateResult.rows[0];
    }

    // Sign JWT access and refresh tokens
    const accessToken = jwt.sign(
      { googleId: user.google_id, email: user.email },
      JWT_ACCESS_SECRET,
      { expiresIn: '7d' }
    );

    const refreshToken = jwt.sign(
      { googleId: user.google_id, id: user.id, email: user.email },
      JWT_REFRESH_SECRET,
      { expiresIn: '30d' }
    );

    // Set tokens in secure HTTP-only cookies
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: 'Authenticated successfully via Google OAuth.',
      user: {
        id: user.id,
        googleId: user.google_id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
      },
    });
  } catch (error) {
    console.error('[AUTH ERROR] Google OAuth callback exchange failed:', error);
    return res.status(500).json({ success: false, message: 'OAuth credentials exchange failed.' });
  }
});

// GET /app/auth/me (Check current login status & perform silent refresh)
authRouter.get('/me', async (req, res): Promise<any> => {
  const cookies = req.cookies || {};
  const accessToken = cookies.access_token;
  const refreshToken = cookies.refresh_token;

  if (!accessToken && !refreshToken) {
    return res.status(401).json({ success: false, loggedIn: false, message: 'No active session found.' });
  }

  try {
    // 1. Try to verify the access token
    if (accessToken) {
      try {
        const decodedAccess = jwt.verify(accessToken, JWT_ACCESS_SECRET) as any;
        let userResult = await query('SELECT * FROM users WHERE google_id = $1', [decodedAccess.googleId]);
        let user = userResult.rows[0];

        if (user) {
          return res.status(200).json({
            success: true,
            loggedIn: true,
            user: {
              id: user.id,
              googleId: user.google_id,
              email: user.email,
              displayName: user.display_name,
              avatarUrl: user.avatar_url,
            },
          });
        }
      } catch (err) {
        console.log('[AUTH] Access token expired or invalid, attempting refresh...');
      }
    }

    // 2. If access token is expired or missing, try to verify the refresh token
    if (refreshToken) {
      const decodedRefresh = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
      let userResult = await query('SELECT * FROM users WHERE google_id = $1', [decodedRefresh.googleId]);
      let user = userResult.rows[0];

      if (user) {
        // Re-sign a new access token
        const newAccessToken = jwt.sign(
          { googleId: user.google_id, email: user.email },
          JWT_ACCESS_SECRET,
          { expiresIn: '7d' }
        );

        // Update cookie
        res.cookie('access_token', newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        console.log(`[AUTH] Silently refreshed access token session for: ${user.email}`);

        return res.status(200).json({
          success: true,
          loggedIn: true,
          user: {
            id: user.id,
            googleId: user.google_id,
            email: user.email,
            displayName: user.display_name,
            avatarUrl: user.avatar_url,
          },
        });
      }
    }

    throw new Error('Tokens invalid or expired');
  } catch (error) {
    // Clear cookies on failure
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return res.status(401).json({ success: false, loggedIn: false, message: 'Session expired. Please log in again.' });
  }
});

// POST /app/auth/logout
authRouter.post('/logout', (req, res) => {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

export default authRouter;
