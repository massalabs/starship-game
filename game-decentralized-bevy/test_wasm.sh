#!/bin/bash
set -ex

export RUST_BACKTRACE=1 

cargo nextest run --fail-fast --run-ignored all