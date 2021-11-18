# ufg.js

A JavaScript library for interfacing with formats in UFG games, primarily LittleBigPlanet Karting.

**This is a work in progress, many things don't work.**

# Setup

As this is a project build with Node.JS, please ensure that you have the latest version installed from [here](https://nodejs.org/en/), then install the package dependencies.
```bash
npm install
```

# Usage

To extract all models and textures from a BIN file, use the following command:
```bash
node run.js <.BIN>
```
All files will be extracted to `output/{BIN_NAME}/{TYPE}`

Certain textures are streamed and are split into *.PERM.BIN and *.TEMP.BIN, use the following command:
```bash
node run.js <.PERM.BIN> <.TEMP.BIN>
```