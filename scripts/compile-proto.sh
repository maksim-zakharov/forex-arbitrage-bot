#!/bin/bash
# Build TS services from proto files.
# See: https://github.com/stephenh/ts-proto
# Usage: ./scripts/compile-proto.sh

OUT_DIR=./src/generated

mkdir -p $OUT_DIR
rm -rf $OUT_DIR/**

protoc \
--plugin="./node_modules/.bin/protoc-gen-ts_proto.cmd" \
--ts_proto_out="$OUT_DIR" \
--ts_proto_opt="outputServices=nice-grpc" \
--ts_proto_opt="outputServices=generic-definitions" \
--ts_proto_opt="oneof=unions" \
--ts_proto_opt="esModuleInterop=true" \
--ts_proto_opt="useOptionals=messages" \
--proto_path=./src/protos \
  ./src/protos/*.proto

# Some magic to make it work with native ESM.
# See: https://github.com/grpc/grpc-node/issues/2009
sed -E -i '' 's|import _m0 from "protobufjs/minimal";|import _m0 from "protobufjs/minimal\.js";|g' $OUT_DIR/*.ts $OUT_DIR/google/protobuf/timestamp.ts
sed -E -i '' 's|from "\./([^"]+)";|from "\./\1\.js";|g' $OUT_DIR/*.ts

read