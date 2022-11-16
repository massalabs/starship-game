# Massa-Starship Game

Bevy implementation (Wasm and Mobile versions)

## Usage

Make sure you have `rust`, `cargo-make` and `wasm32-unknown-unknown` targets installed. The project contains a cargo make file that has the following task: [tasks.build-web]. Running this task using `cargo make build-web` will build the release web wasm file and its js glue code used by the dApp. This is the game engine. The game engine is tightly coupled with the Massa Blockchain and it can only be accessed from within the dApp which bridges between the wasm game engine and the js data that the frontend feeds into the engine. Do not try to run the game engine alone using `cargo run` as this wont render the full game as you would expect it.