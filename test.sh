#!/bin/bash

# Testing smart contract funcs ...
#cargo test -- --nocapture

export RUST_BACKTRACE=1 

cargo nextest run --fail-fast --run-ignored all --nocapture

# DONE!
