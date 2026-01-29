#!/bin/bash
# Upgrade Rust to nightly and rebuild Anchor project

echo "🔧 Upgrading Rust to nightly toolchain..."
rustup install nightly

echo "🔄 Setting nightly as default..."
rustup default nightly

echo "✅ Rust upgraded! New version:"
rustc --version
cargo --version

echo ""
echo "🏗️  Building Anchor project..."
cd /home/rai/Dev/rialopulse
anchor build

echo ""
echo "✅ Done! If build succeeded, Switchboard oracle integration is ready."
