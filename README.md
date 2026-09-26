# Farhan & Tiara ♡ — Romantic Memory Album

Static romantic album website + Supabase database/storage/auth.

No React, Node build, or package install is required. You can upload these files directly to GitHub and deploy the repo on Vercel.

## Features

- Romantic opening page: **Farhan & Tiara**
- Floating hearts, polaroid hero, love letter
- Days-together counter
- Public memory gallery
- Photo / video upload
- Favorites, date, caption, search, filters
- Fullscreen lightbox
- Supabase Auth owner login
- Public-read + owner-write security using RLS
- Supabase Storage for album media
- Spotify track / playlist / album embed
- YouTube embed (tries to autoplay only after the visitor taps the opening button)
- Cover photo editable from the owner panel
- Mobile responsive

---

# 1. Create Supabase project

Go to Supabase and create a project.

Open **SQL Editor**, paste all contents of `supabase.sql`, then Run.

This creates:

- `album_settings`
- `memories`
- `album_admins`
- `album-media` Storage bucket
- RLS policies
- `is_album_admin()` helper function

---

# 2. Create Farhan's owner account

In Supabase:

**Authentication → Users → Add user**

Create an email/password user for Farhan.

Copy the user's UUID.

Then return to SQL Editor and run:

```sql
insert into public.album_admins (user_id)
values ('PASTE_FARHAN_USER_UUID_HERE'::uuid)
on conflict (user_id) do nothing;
```

Only users listed in `album_admins` can change the album.

---

# 3. Connect the website to Supabase

Open `config.js`.

Replace:

```js
SUPABASE_URL: "PASTE_YOUR_SUPABASE_URL_HERE",
SUPABASE_ANON_KEY: "PASTE_YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY_HERE"
```

You can find those in your Supabase project API settings.

**Never put a service_role / secret key in this website.**

The public anon/publishable key is fine in a browser app because the actual permissions are enforced by RLS.

---

# 4. Upload to GitHub

Create a new GitHub repository.

Upload these files into the root:

```text
index.html
style.css
app.js
config.js
supabase.sql
vercel.json
README.md
```

Commit them.

---

# 5. Deploy on Vercel

1. Open Vercel.
2. Add New → Project.
3. Import your GitHub repository.
4. Framework Preset: **Other**.
5. No build command is required.
6. Deploy.

Because the project is static, Vercel can serve `index.html` directly.

---

# 6. How Farhan manages the album

Open the deployed website.

Tap the small **♙** icon in the top right.

Log in using Farhan's Supabase email/password.

The owner can:

- add photos/videos
- mark favorites
- delete memories
- set anniversary date
- change cover
- edit romantic text
- paste Spotify/YouTube song
- change the song label

Visitors do not need to log in.

---

# 7. Spotify / YouTube music

In **Album Settings → Our song**, paste:

Spotify examples:

```text
https://open.spotify.com/track/...
https://open.spotify.com/playlist/...
https://open.spotify.com/album/...
```

YouTube examples:

```text
https://youtu.be/...
https://www.youtube.com/watch?v=...
```

Spotify is rendered through the official Spotify embed. The visitor may still need to press play inside Spotify.

YouTube is loaded after the visitor taps **Open Our Memories**, so the browser may allow playback with sound. Browser autoplay rules still apply and cannot be bypassed reliably.

---

# 8. Photo size

The browser automatically compresses large photos before uploading.

The current client intentionally stops files larger than about 8 MB after photo compression. This keeps the simple browser upload reliable.

For large iPhone videos, use a compressed video or later switch the upload implementation to Supabase resumable/TUS uploads.

---

## Personalizing the default name

The default title is **Farhan & Tiara**.

After owner login, open **Album settings** and you can change everything from the website itself.
