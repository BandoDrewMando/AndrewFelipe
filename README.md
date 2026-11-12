# Andrew Felipe

My personal site: https://bandodrewmando.github.io/AndrewFelipe/

Plain HTML, CSS and JavaScript. There is no build step: what is in this repo is what GitHub Pages serves.

- `index.html`, `styles.css`, `app.js`: the home page, and the styles every page shares
- `work-demos/`: clickable rebuilds of my work at WT Cox Information Services
- `projects/ando/`, `projects/hearth/`, `projects/mochi/`: a write-up of each app, with a recording or
  screenshots of the real thing and small simulations of its rules (`sim.js` in each folder)
- `how-i-build/`: how I work with an AI coding agent, and what I keep in my own hands
- `assets/`: the fonts (VT323 and Chakra Petch, served from here, with their licences) and the pictures
  and clips for each project

## The pictures and the simulations

- Recordings and screenshots show the real apps running on test copies: a simulated house, a test
  island, a test inbox. None of my own data is in them.
- The simulations run in the browser on invented data. Each one follows the same rules as the app's own
  code, so the answer on the page is the answer the app would give.

## Looking at it on your own computer

```
python3 -m http.server 8000
```

Then open http://localhost:8000/. The pages use relative links, so they work from any folder.
