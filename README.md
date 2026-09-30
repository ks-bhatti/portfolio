# M. Kamran Saleem | Developer portfolio

A responsive static portfolio for M. Kamran Saleem (KS Bhatti). HTML, CSS, vanilla JavaScript, and a locally hosted, pinned Three.js 0.170.0 module. No framework, package installation, or build step is needed to serve the site.

## Local preview

From this folder:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Open <http://127.0.0.1:4173>. Use HTTP instead of opening `index.html` directly, because browser ES modules and texture loading require a server.

## Files

```text
index.html                  Portfolio and semantic page content
404.html                    Custom not-found page
.nojekyll                   Serve static files directly on GitHub Pages
robots.txt                  Search crawler configuration
sitemap.xml                 Canonical homepage
assets/
  profile.jpg               Supplied original photo, already added
  profile.webp              Optimized photo, already added
  cv.pdf                    Add your real CV here
  favicon.svg               Site icon
  css/style.css             Responsive layout and both themes
  js/app.js                 Navigation, themes, reveals, project details, CV
  js/scene.js               Lazy-loaded 3D scene and its configuration
  fonts/                    Local Manrope font and OFL license
  vendor/                   Three.js 0.170.0 and MIT license
qa/smoke.cjs                 Browser verification script, not a build step
```

## Your photo and CV

- `assets/profile.jpg` is already populated with the photo supplied in the request. You do not need to add it again.
- `assets/profile.webp` is an optimized 432 × 432 copy, approximately 44 KB.
- **You still need to add `assets/cv.pdf`.** No CV was provided, so the site currently displays **Request CV**, which opens an email request instead of a broken download.
- After adding the PDF, change `const CV_AVAILABLE = false` to `true` in `assets/js/app.js`. The site checks for a successful PDF response before showing **Download CV**. Commit and push both changes.
- For a replacement portrait, replace both image formats. The subtle foreground mask in the `scene.js` fragment shader was shaped for the supplied photo; adjust its head, neck, torso, and arm shapes if the composition changes. It is a lightweight approximation, not a segmented cutout.

## Content and behavior

- All six projects are included. Project detail dialogs provide the supplied facts. Only BIS Connect has a supplied public project URL; other project dialogs offer an email inquiry instead of invented repository or demo links.
- Project cover art is a CSS illustration, not a screenshot of the actual product. Decorative charts do not represent measured business data.
- Dark and light themes persist in local browser storage when permitted.
- Navigation, email, GitHub, LinkedIn, Fiverr, and BIS Connect links use the supplied destinations.
- A native dialog provides focus containment, Escape-to-close, and focus return for project details.
- The site has semantic sections, a skip link, visible focus states, responsive layouts, metadata, and locally hosted fonts.

## 3D configuration and performance

Edit `SCENE_CONFIG` at the top of `assets/js/scene.js` to tune colors, speeds, card size, particle count, and effect intensity.

- Three.js loads only as the hero enters the viewport and only when reduced motion is off.
- Rendering pauses when the hero leaves the viewport, the tab is hidden, or reduced motion is enabled.
- Pixel ratio is capped at 2. There are 34 particles and a small number of low-poly objects, with no post-processing pipeline.
- The portrait uses a rounded textured plane plus a subtle masked foreground layer. It follows the pointer with easing. Tech badges orbit around it.
- Mobile device tilt is opt-in, with a permission request only where the browser requires it. HTTPS and a device with orientation sensors are required.
- Reduced motion keeps the static photo. WebGL failure also keeps the photo, with a subtle pointer tilt when motion is allowed.
- 60 fps is a target, not a guarantee. Real-device GPU, thermal, and battery conditions affect frame rate.

## GitHub Pages deployment

Target repository: `ks-bhatti/ks-bhatti.github.io`.
Target URL: <https://ks-bhatti.github.io/>.

For first deployment when the user-site repository does not already exist:

```powershell
git init
git branch -M main
git add .
git commit -m "Build responsive developer portfolio"
gh auth login
gh repo create ks-bhatti/ks-bhatti.github.io --public --source . --remote origin --push
gh api --method POST repos/ks-bhatti/ks-bhatti.github.io/pages -f "source[branch]=main" -f "source[path]=/"
```

Skip `gh auth login` if already authenticated. Do not run repository creation again after deployment.

Without GitHub CLI, create a public repository named `ks-bhatti.github.io` on GitHub, then run:

```powershell
git init
git branch -M main
git add .
git commit -m "Build responsive developer portfolio"
git remote add origin https://github.com/ks-bhatti/ks-bhatti.github.io.git
git push -u origin main
```

In the repository, open **Settings → Pages → Build and deployment**. Set **Source** to **Deploy from a branch**, select **main**, choose **/ (root)**, and save. GitHub will show the published URL when deployment completes.

If `ks-bhatti.github.io` already exists before a fresh setup, use `portfolio` instead. Replace the repository name in the commands and update the canonical, Open Graph, robots, and sitemap URLs to `https://ks-bhatti.github.io/portfolio/`. All site assets use relative paths. The 404 page also supports `/portfolio/`.

Subsequent changes:

```powershell
git add .
git commit -m "Update portfolio"
git push origin main
```

## Verification

`qa/smoke.cjs` checks responsive overflow, page errors, asset responses, theme persistence, project dialogs, mobile navigation, and 3D/static fallback behavior using Playwright. Screenshots and output reports are ignored by Git. Browser automation is a development tool and is not required by the deployed site.

Manual device checks should include iOS orientation permission and real-phone rendering performance. LinkedIn and Fiverr may block automated link checkers; their supplied URLs remain unchanged.

## Third-party licenses

- Three.js 0.170.0: MIT, `assets/vendor/THREE-LICENSE.txt`.
- Manrope: SIL Open Font License, `assets/fonts/OFL-Manrope.txt`.

Source references: [Three.js documentation](https://threejs.org/docs/) and [GitHub Pages setup](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).
