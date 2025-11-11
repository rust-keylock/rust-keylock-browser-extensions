#!/bin/bash

set -e

BASEDIR=$(dirname "$0")
cd $BASEDIR/../
BASEDIR=`pwd`
wasm-pack build $BASEDIR/rust --target web --out-dir $BASEDIR/extension/pkg --release
