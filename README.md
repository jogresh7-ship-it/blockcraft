# Blockcraft

A Minecraft-like voxel game written in plain JavaScript and WebGL2, with no game engine and no build step.

**Play:** open `index.html` through any static web server (for example `python3 -m http.server`), or turn on GitHub Pages for this repo.

## Features
- Realistic world generation: continents, ridged mountains, winding rivers, beaches, swamps, and about 25 biomes
- Caves, ore veins, the Nether, redstone, mobs, survival and creative modes
- Over 1,250 blocks with vanilla models, including fences, walls and panes that connect, potted plants, slabs, buttons, rails, pistons and more
- Java- and Bedrock-style menus, skins, third-person view, and mod and resource-pack importing (any Java resource pack `.zip`)
- Keyboard and mouse, controller, and touch (on phones and tablets)

## Multiplayer
The host picks **Open to Friends** in the pause menu and gets a 6-letter code. Friends tap **Multiplayer** (or **Friends** on phones) on the title screen and enter it. Connections go browser-to-browser (WebRTC, matchmaking by the free PeerJS service), so both players need internet. Positions, skins, block changes, chat, time and mobs are shared; the host's browser keeps the world.

## Mods
Zip a mod's folder (for example `mods/minimap`) and import it from the Mods screen. Mods get an `api` object with events such as `tick`, `hud`, `join` and `blockBreak`.
- **Minimap:** a minimap in the top-right corner. Press M for the full world map and N to zoom.

## Controls
WASD to move, Space to jump, mouse to look, left click to break, right click to place, E for inventory, T for chat, F5 for third person.

## Assets and licenses
- Block, item and GUI textures are derived from [Faithful](https://faithfulpack.net) (see `FAITHFUL-LICENSE.txt`).
- Controller prompt icons are from [Kenney](https://kenney.nl) (CC0).
- Mojang textures and sounds are **not** included. For sound, load a Minecraft sound pack `.zip` under Options > Music & Sounds. You can also import a resource pack from the Resource Packs screen.
- `tools/` holds the Python scripts used to build the texture atlas and convert block models.

Blockcraft is a fan project. It is not affiliated with Mojang or Microsoft.
