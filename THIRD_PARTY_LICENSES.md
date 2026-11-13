# 第三方许可证清单

叮咪的代码用 [AGPL-3.0](LICENSE) 许可证。叮咪里用到了下面这些别人的代码、字体和图标，它们各自的许可证照旧有效。

这份清单由 `node scripts/licenses.mjs` 生成，改了依赖以后重新跑一次，不要手改。
只列编进程序、打进界面的；只在开发、打包、测试时用的工具（Vite、TypeScript、Vitest 等）不列。

## 字体、图标和内嵌的代码

| 名字 | 用在哪 | 许可证 | 说明 |
| --- | --- | --- | --- |
| 文渊圆体（WenYuan Rounded SC）1.110 | 电脑端界面的字体：apps/desktop/ui/fonts/dingmi-rounded.woff2（裁剪成常用字，改名 Dingmi Rounded，做法见 scripts/build-font.py） | OFL-1.1 | © 2024-2026 Takushun Wu（保留字体名 WenYuan Rounded、文渊圆体），字形来自思源黑体（© Adobe，保留字体名 Source）、SN Pro 等，各方版权见许可证全文：apps/desktop/ui/fonts/OFL.txt。https://github.com/takushun-wu/WenYuanFonts |
| Lucide 图标 | 电脑端和手机网页里的图标：shared/icons.ts 从 npm 包 lucide 里取图标数据 | ISC | © Lucide Contributors；一部分图标来自 Feather（© Cole Bemis，MIT）。https://lucide.dev/license |
| TweetNaCl.js（nacl-fast.min.js） | 手机网页的加密：apps/server/web/nacl-fast.min.js，服务器发手机网页时内嵌进去 | Unlicense | 公有领域。https://github.com/dchest/tweetnacl-js |
| Tauri 安装包中文文字 | apps/desktop/src-tauri/windows/SimpChinese.nsh（从 tauri-cli 2.12.4 自带的那份拷来改的） | Apache-2.0 OR MIT | https://github.com/tauri-apps/tauri |
| NSIS | 安装包（Tauri 用 NSIS 打包，安装包里带着 NSIS 的安装程序外壳） | Zlib | 源码里没有，只在打出来的安装包里。https://nsis.sourceforge.io/License |
| Microsoft Edge WebView2 安装程序 | 安装包里带的 WebView2 引导程序（tauri.conf.json 的 embedBootstrapper），没有 WebView2 的电脑装叮咪时顺手装上 | 微软的分发许可 | 源码里没有，只在打出来的安装包里；WebView2 是系统组件（AGPL 第 1 节说的「系统库」）。https://developer.microsoft.com/microsoft-edge/webview2/ |

本版纸页轨道图标与助手为原创；保留的上游品牌说明见 TRADEMARK.md，本版不分发其受限素材。第三方许可全文见 licenses/THIRD_PARTY_NOTICES.txt。

## Rust 依赖（426 个）

桌面端统计 Windows x64 与 macOS Apple Silicon；服务器统计 Linux 与 Windows。知识库为 jarvis-workspace。

| 名字 | 版本 | 许可证 | 用在 |
| --- | --- | --- | --- |
| [adler2](https://github.com/oyvindln/adler2) | 2.0.1 | 0BSD OR MIT OR Apache-2.0 | 桌面端 |
| [aead](https://github.com/RustCrypto/traits) | 0.5.2 | MIT OR Apache-2.0 | 桌面端、服务器、同步库 |
| [aes](https://github.com/RustCrypto/block-ciphers) | 0.8.4 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [aes-gcm](https://github.com/RustCrypto/AEADs) | 0.10.3 | Apache-2.0 OR MIT | 桌面端、服务器、同步库 |
| [ahash](https://github.com/tkaitchuck/ahash) | 0.8.12 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [aho-corasick](https://github.com/BurntSushi/aho-corasick) | 1.1.5 | Unlicense OR MIT | 桌面端 |
| [alloc-no-stdlib](https://github.com/dropbox/rust-alloc-no-stdlib) | 3.0.0 | BSD-3-Clause | 桌面端 |
| [alloc-stdlib](https://github.com/dropbox/rust-alloc-no-stdlib) | 0.3.0 | BSD-3-Clause | 桌面端 |
| [anyhow](https://github.com/dtolnay/anyhow) | 1.0.104 | MIT OR Apache-2.0 | 桌面端 |
| [argon2](https://github.com/RustCrypto/password-hashes/tree/master/argon2) | 0.5.3 | MIT OR Apache-2.0 | 桌面端 |
| [asn1-rs](https://github.com/rusticata/asn1-rs.git) | 0.6.2 | MIT OR Apache-2.0 | 服务器 |
| [asn1-rs-derive](https://github.com/rusticata/asn1-rs.git) | 0.5.1 | MIT OR Apache-2.0 | 服务器 |
| [asn1-rs-impl](https://github.com/rusticata/asn1-rs.git) | 0.2.0 | MIT/Apache-2.0 | 服务器 |
| [atomic-waker](https://github.com/smol-rs/atomic-waker) | 1.1.2 | Apache-2.0 OR MIT | 桌面端、服务器、知识库 |
| [autocfg](https://github.com/cuviper/autocfg) | 1.5.1 | Apache-2.0 OR MIT | 桌面端、服务器、知识库 |
| [base64](https://github.com/marshallpierce/rust-base64) | 0.21.7 | MIT OR Apache-2.0 | 桌面端 |
| [base64](https://github.com/marshallpierce/rust-base64) | 0.22.1 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [base64](https://github.com/marshallpierce/rust-base64) | 0.23.1 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [base64ct](https://github.com/RustCrypto/formats) | 1.8.3 | Apache-2.0 OR MIT | 桌面端 |
| [bit-set](https://github.com/contain-rs/bit-set) | 0.8.0 | Apache-2.0 OR MIT | 桌面端 |
| [bit-vec](https://github.com/contain-rs/bit-vec) | 0.8.0 | Apache-2.0 OR MIT | 桌面端 |
| [bitflags](https://github.com/bitflags/bitflags) | 1.3.2 | MIT/Apache-2.0 | 桌面端 |
| [bitflags](https://github.com/bitflags/bitflags) | 2.13.2 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [blake2](https://github.com/RustCrypto/hashes) | 0.10.6 | MIT OR Apache-2.0 | 桌面端、服务器、同步库 |
| [block-buffer](https://github.com/RustCrypto/utils) | 0.10.4 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [block2](https://github.com/madsmtm/objc2) | 0.6.2 | MIT | 桌面端 |
| [brotli](https://github.com/dropbox/rust-brotli) | 9.1.1 | BSD-3-Clause AND MIT | 桌面端 |
| [brotli-decompressor](https://github.com/dropbox/rust-brotli-decompressor) | 6.2.0 | BSD-3-Clause/MIT | 桌面端 |
| [bs58](https://github.com/Nullus157/bs58-rs) | 0.5.1 | MIT/Apache-2.0 | 桌面端 |
| [bumpalo](https://github.com/fitzgen/bumpalo) | 3.20.3 | MIT OR Apache-2.0 | 桌面端 |
| [bytemuck](https://github.com/Lokathor/bytemuck) | 1.25.2 | Zlib OR Apache-2.0 OR MIT | 桌面端 |
| [byteorder](https://github.com/BurntSushi/byteorder) | 1.5.0 | Unlicense OR MIT | 桌面端 |
| [byteorder-lite](https://github.com/image-rs/byteorder-lite) | 0.1.0 | Unlicense OR MIT | 桌面端 |
| [bytes](https://github.com/tokio-rs/bytes) | 1.12.1 | MIT | 桌面端、服务器、同步库、知识库 |
| [camino](https://github.com/camino-rs/camino) | 1.2.6 | MIT OR Apache-2.0 | 桌面端 |
| [cargo_metadata](https://github.com/oli-obk/cargo_metadata) | 0.19.2 | MIT | 桌面端 |
| [cargo_toml](https://gitlab.com/lib.rs/cargo_toml) | 1.0.1 | Apache-2.0 OR MIT | 桌面端 |
| [cargo-platform](https://github.com/rust-lang/cargo) | 0.1.9 | MIT OR Apache-2.0 | 桌面端 |
| [cc](https://github.com/rust-lang/cc-rs) | 1.10.0 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [cfb](https://github.com/mdsteele/rust-cfb) | 0.14.0 | MIT | 桌面端 |
| [cfg_aliases](https://github.com/katharostech/cfg_aliases) | 0.2.2 | MIT | 桌面端、知识库 |
| [cfg-if](https://github.com/rust-lang/cfg-if) | 1.0.5 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [chacha20](https://github.com/RustCrypto/stream-ciphers) | 0.9.1 | Apache-2.0 OR MIT | 桌面端、服务器、同步库 |
| [chacha20](https://github.com/RustCrypto/stream-ciphers) | 0.10.2 | MIT OR Apache-2.0 | 桌面端、知识库 |
| [chacha20poly1305](https://github.com/RustCrypto/AEADs/tree/master/chacha20poly1305) | 0.10.1 | Apache-2.0 OR MIT | 桌面端、服务器、同步库 |
| [chrono](https://github.com/chronotope/chrono) | 0.4.45 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [cipher](https://github.com/RustCrypto/traits) | 0.4.4 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [cookie](https://github.com/SergioBenitez/cookie-rs) | 0.18.2 | MIT OR Apache-2.0 | 桌面端 |
| [core-foundation](https://github.com/servo/core-foundation-rs) | 0.9.4 | MIT OR Apache-2.0 | 桌面端、知识库 |
| [core-foundation](https://github.com/servo/core-foundation-rs) | 0.10.1 | MIT OR Apache-2.0 | 桌面端 |
| [core-foundation-sys](https://github.com/servo/core-foundation-rs) | 0.8.7 | MIT OR Apache-2.0 | 桌面端、知识库 |
| [core-graphics](https://github.com/servo/core-foundation-rs) | 0.25.0 | MIT OR Apache-2.0 | 桌面端 |
| [core-graphics-types](https://github.com/servo/core-foundation-rs) | 0.2.0 | MIT OR Apache-2.0 | 桌面端 |
| [cpufeatures](https://github.com/RustCrypto/utils) | 0.2.17 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [cpufeatures](https://github.com/RustCrypto/utils) | 0.3.1 | MIT OR Apache-2.0 | 桌面端、知识库 |
| [crc32fast](https://github.com/srijs/rust-crc32fast) | 1.5.3 | MIT OR Apache-2.0 | 桌面端 |
| [crossbeam-channel](https://github.com/crossbeam-rs/crossbeam) | 0.5.17 | MIT OR Apache-2.0 | 桌面端 |
| [crossbeam-utils](https://github.com/crossbeam-rs/crossbeam) | 0.8.23 | MIT OR Apache-2.0 | 桌面端 |
| [crypto_box](https://github.com/RustCrypto/nacl-compat/tree/master/crypto_box) | 0.9.1 | Apache-2.0 OR MIT | 桌面端 |
| [crypto_secretbox](https://github.com/RustCrypto/nacl-compat/tree/master/crypto_secretbox) | 0.1.1 | Apache-2.0 OR MIT | 桌面端 |
| [crypto-common](https://github.com/RustCrypto/traits) | 0.1.7 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [cssparser](https://github.com/servo/rust-cssparser) | 0.37.0 | MPL-2.0 | 桌面端 |
| [cssparser-macros](https://github.com/servo/rust-cssparser) | 0.7.1 | MPL-2.0 | 桌面端 |
| [ctor](https://github.com/mmastrac/linktime) | 1.0.13 | Apache-2.0 OR MIT | 桌面端 |
| [ctr](https://github.com/RustCrypto/block-modes) | 0.9.2 | MIT OR Apache-2.0 | 桌面端、服务器、同步库 |
| [curve25519-dalek](https://github.com/dalek-cryptography/curve25519-dalek/tree/main/curve25519-dalek) | 4.1.3 | BSD-3-Clause | 桌面端、服务器、同步库 |
| [curve25519-dalek-derive](https://github.com/dalek-cryptography/curve25519-dalek) | 0.1.1 | MIT/Apache-2.0 | 桌面端、服务器、同步库 |
| [darling](https://github.com/TedDriggs/darling) | 0.24.1 | MIT | 桌面端 |
| [darling_core](https://github.com/TedDriggs/darling) | 0.24.1 | MIT | 桌面端 |
| [darling_macro](https://github.com/TedDriggs/darling) | 0.24.1 | MIT | 桌面端 |
| [data-encoding](https://github.com/ia0/data-encoding) | 2.11.1 | MIT | 服务器 |
| [defmt](https://github.com/knurling-rs/defmt) | 1.2.0 | MIT OR Apache-2.0 | 桌面端 |
| [defmt-macros](https://github.com/knurling-rs/defmt) | 1.2.0 | MIT OR Apache-2.0 | 桌面端 |
| [defmt-parser](https://github.com/knurling-rs/defmt) | 1.1.0 | MIT OR Apache-2.0 | 桌面端 |
| [der-parser](https://github.com/rusticata/der-parser.git) | 9.0.0 | MIT/Apache-2.0 | 服务器 |
| [deranged](https://github.com/jhpratt/deranged) | 0.5.9 | MIT OR Apache-2.0 | 桌面端、服务器 |
| [derive_more](https://github.com/JelteF/derive_more) | 2.1.1 | MIT | 桌面端 |
| [derive_more-impl](https://github.com/JelteF/derive_more) | 2.1.1 | MIT | 桌面端 |
| [digest](https://github.com/RustCrypto/traits) | 0.10.7 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [dirs](https://codeberg.org/dirs/dirs-rs) | 7.0.0 | MIT OR Apache-2.0 | 桌面端 |
| [dirs-sys](https://github.com/dirs-dev/dirs-sys-rs) | 0.5.0 | MIT OR Apache-2.0 | 桌面端 |
| [dispatch2](https://github.com/madsmtm/objc2) | 0.3.1 | Zlib OR Apache-2.0 OR MIT | 桌面端 |
| [displaydoc](https://github.com/yaahc/displaydoc) | 0.2.7 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [dom_query](https://github.com/niklak/dom_query) | 0.28.0 | MIT | 桌面端 |
| [dpi](https://github.com/rust-windowing/winit) | 0.1.2 | Apache-2.0 AND MIT | 桌面端 |
| [dtoa](https://github.com/dtolnay/dtoa) | 1.0.11 | MIT OR Apache-2.0 | 桌面端 |
| [dtoa-short](https://github.com/upsuper/dtoa-short) | 0.3.5 | MPL-2.0 | 桌面端 |
| [dunce](https://gitlab.com/kornelski/dunce) | 1.0.5 | CC0-1.0 OR MIT-0 OR Apache-2.0 | 桌面端 |
| [dyn-clone](https://github.com/dtolnay/dyn-clone) | 1.0.20 | MIT OR Apache-2.0 | 桌面端 |
| [embed_plist](https://github.com/nvzqz/embed-plist-rs) | 1.2.2 | MIT OR Apache-2.0 | 桌面端 |
| [embed-resource](https://github.com/nabijaczleweli/rust-embed-resource) | 3.0.12 | MIT | 桌面端 |
| [equivalent](https://github.com/indexmap-rs/equivalent) | 1.0.3 | Apache-2.0 OR MIT | 桌面端 |
| [erased-serde](https://github.com/dtolnay/erased-serde) | 0.4.11 | MIT OR Apache-2.0 | 桌面端 |
| [errno](https://github.com/lambda-fairy/rust-errno) | 0.3.14 | MIT OR Apache-2.0 | 桌面端 |
| [fallible-iterator](https://github.com/sfackler/rust-fallible-iterator) | 0.3.0 | MIT/Apache-2.0 | 桌面端、服务器、知识库 |
| [fallible-streaming-iterator](https://github.com/sfackler/fallible-streaming-iterator) | 0.1.9 | MIT/Apache-2.0 | 桌面端、服务器、知识库 |
| [fastrand](https://github.com/smol-rs/fastrand) | 2.5.0 | Apache-2.0 OR MIT | 桌面端 |
| [fdeflate](https://github.com/image-rs/fdeflate) | 0.3.7 | MIT OR Apache-2.0 | 桌面端 |
| [filetime](https://github.com/alexcrichton/filetime) | 0.2.29 | MIT/Apache-2.0 | 桌面端 |
| [find-msvc-tools](https://github.com/rust-lang/cc-rs) | 0.1.15 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [flate2](https://github.com/rust-lang/flate2-rs) | 1.1.10 | MIT OR Apache-2.0 | 桌面端 |
| [fnv](https://github.com/servo/rust-fnv) | 1.0.7 | Apache-2.0 / MIT | 桌面端 |
| [foldhash](https://github.com/orlp/foldhash) | 0.2.0 | Zlib | 桌面端 |
| [foreign-types](https://github.com/sfackler/foreign-types) | 0.5.0 | MIT/Apache-2.0 | 桌面端 |
| [foreign-types-macros](https://github.com/sfackler/foreign-types) | 0.2.4 | MIT/Apache-2.0 | 桌面端 |
| [foreign-types-shared](https://github.com/sfackler/foreign-types) | 0.3.1 | MIT/Apache-2.0 | 桌面端 |
| [form_urlencoded](https://github.com/servo/rust-url) | 1.2.2 | MIT OR Apache-2.0 | 桌面端、知识库 |
| [futures-channel](https://github.com/rust-lang/futures-rs) | 0.3.34 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [futures-core](https://github.com/rust-lang/futures-rs) | 0.3.34 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [futures-io](https://github.com/rust-lang/futures-rs) | 0.3.34 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [futures-macro](https://github.com/rust-lang/futures-rs) | 0.3.34 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [futures-sink](https://github.com/rust-lang/futures-rs) | 0.3.34 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [futures-task](https://github.com/rust-lang/futures-rs) | 0.3.34 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [futures-util](https://github.com/rust-lang/futures-rs) | 0.3.34 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [generic-array](https://github.com/fizyk20/generic-array.git) | 0.14.7 | MIT | 桌面端、服务器、同步库、知识库 |
| [getrandom](https://github.com/rust-random/getrandom) | 0.2.17 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [getrandom](https://github.com/rust-random/getrandom) | 0.3.4 | MIT OR Apache-2.0 | 桌面端 |
| [getrandom](https://github.com/rust-random/getrandom) | 0.4.3 | MIT OR Apache-2.0 | 桌面端、知识库 |
| [ghash](https://github.com/RustCrypto/universal-hashes) | 0.5.1 | Apache-2.0 OR MIT | 桌面端、服务器、同步库 |
| [glob](https://github.com/rust-lang/glob) | 0.3.4 | MIT OR Apache-2.0 | 桌面端 |
| [global-hotkey](https://github.com/tauri-apps/global-hotkey) | 0.8.0 | Apache-2.0 OR MIT | 桌面端 |
| [hashbrown](https://github.com/rust-lang/hashbrown) | 0.12.3 | MIT OR Apache-2.0 | 桌面端 |
| [hashbrown](https://github.com/rust-lang/hashbrown) | 0.14.5 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [hashbrown](https://github.com/rust-lang/hashbrown) | 0.17.1 | MIT OR Apache-2.0 | 桌面端 |
| [hashlink](https://github.com/kyren/hashlink) | 0.9.1 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [heck](https://github.com/withoutboats/heck) | 0.5.0 | MIT OR Apache-2.0 | 桌面端 |
| [hex](https://github.com/KokaKiwi/rust-hex) | 0.4.3 | MIT OR Apache-2.0 | 桌面端 |
| [hkdf](https://github.com/RustCrypto/KDFs/) | 0.12.4 | MIT OR Apache-2.0 | 桌面端 |
| [hmac](https://github.com/RustCrypto/MACs) | 0.12.1 | MIT OR Apache-2.0 | 桌面端 |
| [html5ever](https://github.com/servo/html5ever) | 0.39.0 | MIT OR Apache-2.0 | 桌面端 |
| [http](https://github.com/hyperium/http) | 1.5.0 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [http-body](https://github.com/hyperium/http-body) | 1.1.0 | MIT | 桌面端、服务器、知识库 |
| [http-body-util](https://github.com/hyperium/http-body) | 0.1.5 | MIT | 桌面端、服务器、知识库 |
| [http-range](https://github.com/bancek/rust-http-range.git) | 0.1.6 | MIT | 桌面端 |
| [httparse](https://github.com/seanmonstar/httparse) | 1.10.1 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [httpdate](https://github.com/pyfisch/httpdate) | 1.0.3 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [hyper](https://github.com/hyperium/hyper) | 1.12.0 | MIT | 桌面端、服务器、知识库 |
| [hyper-rustls](https://github.com/rustls/hyper-rustls) | 0.27.10 | Apache-2.0 OR ISC OR MIT | 桌面端、知识库 |
| [hyper-util](https://github.com/hyperium/hyper-util) | 0.1.21 | MIT | 桌面端、服务器、知识库 |
| [iana-time-zone](https://github.com/strawlab/iana-time-zone) | 0.1.65 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [ico](https://github.com/mdsteele/rust-ico) | 0.6.0 | MIT | 桌面端 |
| [icu_collections](https://github.com/unicode-org/icu4x) | 2.4.0 | Unicode-3.0 | 桌面端、知识库 |
| [icu_locale_core](https://github.com/unicode-org/icu4x) | 2.4.0 | Unicode-3.0 | 桌面端、知识库 |
| [icu_normalizer](https://github.com/unicode-org/icu4x) | 2.4.0 | Unicode-3.0 | 桌面端、知识库 |
| [icu_normalizer_data](https://github.com/unicode-org/icu4x) | 2.4.0 | Unicode-3.0 | 桌面端、知识库 |
| [icu_properties](https://github.com/unicode-org/icu4x) | 2.4.0 | Unicode-3.0 | 桌面端、知识库 |
| [icu_properties_data](https://github.com/unicode-org/icu4x) | 2.4.0 | Unicode-3.0 | 桌面端、知识库 |
| [icu_provider](https://github.com/unicode-org/icu4x) | 2.4.0 | Unicode-3.0 | 桌面端、知识库 |
| [ident_case](https://github.com/TedDriggs/ident_case) | 1.0.1 | MIT/Apache-2.0 | 桌面端 |
| [idna](https://github.com/servo/rust-url/) | 1.1.0 | MIT OR Apache-2.0 | 桌面端、知识库 |
| [idna_adapter](https://github.com/hsivonen/idna_adapter) | 1.2.2 | Apache-2.0 OR MIT | 桌面端、知识库 |
| [image](https://github.com/image-rs/image) | 0.25.10 | MIT OR Apache-2.0 | 桌面端 |
| [indexmap](https://github.com/bluss/indexmap) | 1.9.3 | Apache-2.0 OR MIT | 桌面端 |
| [indexmap](https://github.com/indexmap-rs/indexmap) | 2.14.2 | Apache-2.0 OR MIT | 桌面端 |
| [infer](https://github.com/bojand/infer) | 0.22.0 | MIT | 桌面端 |
| [inout](https://github.com/RustCrypto/utils) | 0.1.4 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [ipnet](https://github.com/krisprice/ipnet) | 2.12.2 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [itoa](https://github.com/dtolnay/itoa) | 1.0.18 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [jiff](https://github.com/BurntSushi/jiff) | 0.2.38 | Unlicense OR MIT | 桌面端 |
| [jiff-core](https://github.com/BurntSushi/jiff) | 0.1.1 | Unlicense OR MIT | 桌面端 |
| [jiff-tzdb](https://github.com/BurntSushi/jiff) | 0.1.9 | Unlicense OR MIT | 桌面端 |
| [jiff-tzdb-platform](https://github.com/BurntSushi/jiff) | 0.1.3 | Unlicense OR MIT | 桌面端 |
| [json-patch](https://github.com/idubrov/json-patch) | 4.2.0 | MIT/Apache-2.0 | 桌面端 |
| [jsonptr](https://github.com/chanced/jsonptr) | 0.7.1 | MIT OR Apache-2.0 | 桌面端 |
| [keyboard-types](https://github.com/pyfisch/keyboard-types) | 0.7.0 | MIT OR Apache-2.0 | 桌面端 |
| [keyboard-types](https://github.com/rust-windowing/keyboard-types) | 0.8.3 | MIT OR Apache-2.0 | 桌面端 |
| [keyring](https://github.com/hwchen/keyring-rs.git) | 3.6.3 | MIT OR Apache-2.0 | 桌面端 |
| [lazy_static](https://github.com/rust-lang-nursery/lazy-static.rs) | 1.5.1 | MIT OR Apache-2.0 | 服务器 |
| [libc](https://github.com/rust-lang/libc) | 0.2.191 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [libsqlite3-sys](https://github.com/rusqlite/rusqlite) | 0.30.1 | MIT | 桌面端、服务器、知识库 |
| [litemap](https://github.com/unicode-org/icu4x) | 0.8.3 | Unicode-3.0 | 桌面端、知识库 |
| [lock_api](https://github.com/Amanieu/parking_lot) | 0.4.14 | MIT OR Apache-2.0 | 桌面端 |
| [log](https://github.com/rust-lang/log) | 0.4.34 | MIT OR Apache-2.0 | 桌面端、知识库 |
| [lru-slab](https://github.com/Ralith/lru-slab) | 0.1.3 | MIT OR Apache-2.0 OR Zlib | 桌面端、知识库 |
| [mac-notification-sys](https://github.com/h4llow3En/mac-notification-sys) | 0.6.15 | MIT/Apache-2.0 | 桌面端 |
| [markup5ever](https://github.com/servo/html5ever) | 0.39.0 | MIT OR Apache-2.0 | 桌面端 |
| [memchr](https://github.com/BurntSushi/memchr) | 2.8.3 | Unlicense OR MIT | 桌面端、服务器、同步库、知识库 |
| [mime](https://github.com/hyperium/mime) | 0.3.17 | MIT OR Apache-2.0 | 桌面端 |
| [minimal-lexical](https://github.com/Alexhuszagh/minimal-lexical) | 0.2.1 | MIT/Apache-2.0 | 服务器 |
| [minisign-verify](https://github.com/jedisct1/rust-minisign-verify) | 0.3.0 | MIT | 桌面端 |
| [miniz_oxide](https://github.com/Frommi/miniz_oxide/tree/master/miniz_oxide) | 0.8.9 | MIT OR Zlib OR Apache-2.0 | 桌面端 |
| [miniz_oxide](https://github.com/Frommi/miniz_oxide/tree/master/miniz_oxide) | 0.9.1 | MIT OR Zlib OR Apache-2.0 | 桌面端 |
| [mio](https://github.com/tokio-rs/mio) | 1.2.4 | MIT | 桌面端、服务器、同步库、知识库 |
| [moxcms](https://github.com/awxkee/moxcms.git) | 0.8.1 | BSD-3-Clause OR Apache-2.0 | 桌面端 |
| [muda](https://github.com/tauri-apps/muda) | 0.20.0 | Apache-2.0 OR MIT | 桌面端 |
| [new_debug_unreachable](https://github.com/mbrubeck/rust-debug-unreachable) | 1.0.6 | MIT | 桌面端 |
| [nix](https://github.com/nix-rust/nix) | 0.31.3 | MIT | 桌面端 |
| [nom](https://github.com/Geal/nom) | 7.1.3 | MIT | 服务器 |
| [notify-rust](https://github.com/hoodie/notify-rust) | 4.19.0 | MIT OR Apache-2.0 | 桌面端 |
| [num-bigint](https://github.com/rust-num/num-bigint) | 0.4.8 | MIT OR Apache-2.0 | 服务器 |
| [num-conv](https://github.com/jhpratt/num-conv) | 0.2.2 | MIT OR Apache-2.0 | 桌面端、服务器 |
| [num-integer](https://github.com/rust-num/num-integer) | 0.1.47 | MIT OR Apache-2.0 | 服务器 |
| [num-traits](https://github.com/rust-num/num-traits) | 0.2.19 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [objc2](https://github.com/madsmtm/objc2) | 0.6.5 | MIT | 桌面端 |
| [objc2-app-kit](https://github.com/madsmtm/objc2) | 0.3.2 | Zlib OR Apache-2.0 OR MIT | 桌面端 |
| [objc2-core-foundation](https://github.com/madsmtm/objc2) | 0.3.2 | Zlib OR Apache-2.0 OR MIT | 桌面端 |
| [objc2-core-graphics](https://github.com/madsmtm/objc2) | 0.3.2 | Zlib OR Apache-2.0 OR MIT | 桌面端 |
| [objc2-encode](https://github.com/madsmtm/objc2) | 4.1.0 | MIT | 桌面端 |
| [objc2-exception-helper](https://github.com/madsmtm/objc2) | 0.1.1 | Zlib OR Apache-2.0 OR MIT | 桌面端 |
| [objc2-foundation](https://github.com/madsmtm/objc2) | 0.3.2 | MIT | 桌面端 |
| [objc2-io-surface](https://github.com/madsmtm/objc2) | 0.3.2 | Zlib OR Apache-2.0 OR MIT | 桌面端 |
| [objc2-osa-kit](https://github.com/madsmtm/objc2) | 0.3.2 | Zlib OR Apache-2.0 OR MIT | 桌面端 |
| [objc2-quartz-core](https://github.com/madsmtm/objc2) | 0.3.2 | Zlib OR Apache-2.0 OR MIT | 桌面端 |
| [objc2-web-kit](https://github.com/madsmtm/objc2) | 0.3.2 | Zlib OR Apache-2.0 OR MIT | 桌面端 |
| [oid-registry](https://github.com/rusticata/oid-registry.git) | 0.7.1 | MIT OR Apache-2.0 | 服务器 |
| [once_cell](https://github.com/matklad/once_cell) | 1.21.4 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [opaque-debug](https://github.com/RustCrypto/utils) | 0.3.1 | MIT OR Apache-2.0 | 桌面端、服务器、同步库 |
| [option-ext](https://github.com/soc/option-ext.git) | 0.2.0 | MPL-2.0 | 桌面端 |
| [osakit](https://github.com/mdevils/rust-osakit) | 0.3.1 | MIT OR Apache-2.0 | 桌面端 |
| [parking_lot](https://github.com/Amanieu/parking_lot) | 0.12.5 | MIT OR Apache-2.0 | 桌面端 |
| [parking_lot_core](https://github.com/Amanieu/parking_lot) | 0.9.12 | MIT OR Apache-2.0 | 桌面端 |
| [password-hash](https://github.com/RustCrypto/traits/tree/master/password-hash) | 0.5.0 | MIT OR Apache-2.0 | 桌面端 |
| [pem](https://github.com/jcreekmore/pem-rs.git) | 3.0.6 | MIT | 服务器 |
| [percent-encoding](https://github.com/servo/rust-url/) | 2.3.2 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [phf](https://github.com/rust-phf/rust-phf) | 0.13.1 | MIT | 桌面端 |
| [phf_codegen](https://github.com/rust-phf/rust-phf) | 0.13.1 | MIT | 桌面端 |
| [phf_generator](https://github.com/rust-phf/rust-phf) | 0.13.1 | MIT | 桌面端 |
| [phf_macros](https://github.com/rust-phf/rust-phf) | 0.13.1 | MIT | 桌面端 |
| [phf_shared](https://github.com/rust-phf/rust-phf) | 0.13.1 | MIT | 桌面端 |
| [pin-project-lite](https://github.com/taiki-e/pin-project-lite) | 0.2.17 | Apache-2.0 OR MIT | 桌面端、服务器、同步库、知识库 |
| [pinyin](https://github.com/mozillazg/rust-pinyin) | 0.10.0 | MIT | 桌面端 |
| [pkg-config](https://github.com/rust-lang/pkg-config-rs) | 0.3.34 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [plist](https://github.com/ebarnard/rust-plist/) | 1.10.3 | MIT | 桌面端 |
| [png](https://github.com/image-rs/image-png) | 0.18.1 | MIT OR Apache-2.0 | 桌面端 |
| [poly1305](https://github.com/RustCrypto/universal-hashes) | 0.8.0 | Apache-2.0 OR MIT | 桌面端、服务器、同步库 |
| [polyval](https://github.com/RustCrypto/universal-hashes) | 0.6.2 | Apache-2.0 OR MIT | 桌面端、服务器、同步库 |
| [potential_utf](https://github.com/unicode-org/icu4x) | 0.1.6 | Unicode-3.0 | 桌面端、知识库 |
| [powerfmt](https://github.com/jhpratt/powerfmt) | 0.2.1 | MIT OR Apache-2.0 | 桌面端、服务器 |
| [ppv-lite86](https://github.com/cryptocorrosion/cryptocorrosion) | 0.2.21 | MIT OR Apache-2.0 | 服务器 |
| [precomputed-hash](https://github.com/emilio/precomputed-hash) | 0.1.1 | MIT | 桌面端 |
| [proc-macro2](https://github.com/dtolnay/proc-macro2) | 1.0.107 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [pxfm](https://github.com/awxkee/pxfm) | 0.1.30 | BSD-3-Clause OR Apache-2.0 | 桌面端 |
| [quick-xml](https://github.com/tafia/quick-xml) | 0.42.0 | MIT | 桌面端 |
| [quinn](https://github.com/quinn-rs/quinn) | 0.11.12 | MIT OR Apache-2.0 | 桌面端、知识库 |
| [quinn-proto](https://github.com/quinn-rs/quinn) | 0.11.19 | MIT OR Apache-2.0 | 桌面端、知识库 |
| [quinn-udp](https://github.com/quinn-rs/quinn) | 0.5.16 | MIT OR Apache-2.0 | 桌面端、知识库 |
| [quote](https://github.com/dtolnay/quote) | 1.0.47 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [rand](https://github.com/rust-random/rand) | 0.8.8 | MIT OR Apache-2.0 | 服务器 |
| [rand](https://github.com/rust-random/rand) | 0.10.3 | MIT OR Apache-2.0 | 桌面端、知识库 |
| [rand_chacha](https://github.com/rust-random/rand) | 0.3.1 | MIT OR Apache-2.0 | 服务器 |
| [rand_core](https://github.com/rust-random/rand) | 0.6.4 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [rand_core](https://github.com/rust-random/rand_core) | 0.10.1 | MIT OR Apache-2.0 | 桌面端、知识库 |
| [rand_pcg](https://github.com/rust-random/rngs) | 0.10.2 | MIT OR Apache-2.0 | 桌面端、知识库 |
| [raw-window-handle](https://github.com/rust-windowing/raw-window-handle) | 0.6.2 | MIT OR Apache-2.0 OR Zlib | 桌面端 |
| [rcgen](https://github.com/rustls/rcgen) | 0.13.2 | MIT OR Apache-2.0 | 服务器 |
| [ref-cast](https://github.com/dtolnay/ref-cast) | 1.0.27 | MIT OR Apache-2.0 | 桌面端 |
| [ref-cast-impl](https://github.com/dtolnay/ref-cast) | 1.0.27 | MIT OR Apache-2.0 | 桌面端 |
| [regex](https://github.com/rust-lang/regex) | 1.13.1 | MIT OR Apache-2.0 | 桌面端 |
| [regex-automata](https://github.com/rust-lang/regex) | 0.4.18 | MIT OR Apache-2.0 | 桌面端 |
| [regex-syntax](https://github.com/rust-lang/regex) | 0.8.11 | MIT OR Apache-2.0 | 桌面端 |
| [reqwest](https://github.com/seanmonstar/reqwest) | 0.12.28 | MIT OR Apache-2.0 | 桌面端、知识库 |
| [reqwest](https://github.com/seanmonstar/reqwest) | 0.13.5 | MIT OR Apache-2.0 | 桌面端 |
| [rfd](https://github.com/PolyMeilex/rfd) | 0.17.2 | MIT | 桌面端 |
| [ring](https://github.com/briansmith/ring) | 0.17.14 | Apache-2.0 AND ISC | 桌面端、服务器、知识库 |
| [rusqlite](https://github.com/rusqlite/rusqlite) | 0.32.1 | MIT | 桌面端、服务器、知识库 |
| [rustc_version](https://github.com/djc/rustc-version-rs) | 0.4.1 | MIT OR Apache-2.0 | 桌面端、服务器、同步库 |
| [rustc-hash](https://github.com/rust-lang/rustc-hash) | 2.1.3 | Apache-2.0 OR MIT | 桌面端、知识库 |
| [rusticata-macros](https://github.com/rusticata/rusticata-macros.git) | 4.1.0 | MIT/Apache-2.0 | 服务器 |
| [rustix](https://github.com/bytecodealliance/rustix) | 1.1.6 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | 桌面端 |
| [rustls](https://github.com/rustls/rustls) | 0.23.46 | Apache-2.0 OR ISC OR MIT | 桌面端、服务器、知识库 |
| [rustls-pki-types](https://github.com/rustls/pki-types) | 1.15.1 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [rustls-platform-verifier](https://github.com/rustls/rustls-platform-verifier) | 0.7.1 | MIT OR Apache-2.0 | 桌面端 |
| [rustls-webpki](https://github.com/rustls/webpki) | 0.103.16 | ISC | 桌面端、服务器、知识库 |
| [ryu](https://github.com/dtolnay/ryu) | 1.0.23 | Apache-2.0 OR BSL-1.0 | 桌面端、知识库 |
| [salsa20](https://github.com/RustCrypto/stream-ciphers) | 0.10.2 | MIT OR Apache-2.0 | 桌面端 |
| [same-file](https://github.com/BurntSushi/same-file) | 1.0.6 | Unlicense/MIT | 桌面端 |
| [schemars](https://github.com/GREsau/schemars) | 0.8.22 | MIT | 桌面端 |
| [schemars](https://github.com/GREsau/schemars) | 0.9.0 | MIT | 桌面端 |
| [schemars](https://github.com/GREsau/schemars) | 1.2.3 | MIT | 桌面端 |
| [schemars_derive](https://github.com/GREsau/schemars) | 0.8.22 | MIT | 桌面端 |
| [scopeguard](https://github.com/bluss/scopeguard) | 1.2.0 | MIT OR Apache-2.0 | 桌面端 |
| [security-framework](https://github.com/kornelski/rust-security-framework) | 3.7.0 | MIT OR Apache-2.0 | 桌面端 |
| [security-framework-sys](https://github.com/kornelski/rust-security-framework) | 2.17.0 | MIT OR Apache-2.0 | 桌面端 |
| [selectors](https://github.com/servo/stylo) | 0.38.0 | MPL-2.0 | 桌面端 |
| [semver](https://github.com/dtolnay/semver) | 1.0.28 | MIT OR Apache-2.0 | 桌面端、服务器、同步库 |
| [serde](https://github.com/serde-rs/serde) | 1.0.229 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [serde_core](https://github.com/serde-rs/serde) | 1.0.229 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [serde_derive](https://github.com/serde-rs/serde) | 1.0.229 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [serde_derive_internals](https://github.com/serde-rs/serde) | 0.29.1 | MIT OR Apache-2.0 | 桌面端 |
| [serde_json](https://github.com/serde-rs/json) | 1.0.154 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [serde_repr](https://github.com/dtolnay/serde-repr) | 0.1.21 | MIT OR Apache-2.0 | 桌面端 |
| [serde_spanned](https://github.com/toml-rs/toml) | 1.1.2 | MIT OR Apache-2.0 | 桌面端 |
| [serde_urlencoded](https://github.com/nox/serde_urlencoded) | 0.7.1 | MIT/Apache-2.0 | 桌面端、知识库 |
| [serde_with](https://github.com/jonasbb/serde_with/) | 3.24.0 | MIT OR Apache-2.0 | 桌面端 |
| [serde_with_macros](https://github.com/jonasbb/serde_with/) | 3.24.0 | MIT OR Apache-2.0 | 桌面端 |
| [serde-untagged](https://github.com/dtolnay/serde-untagged) | 0.1.9 | MIT OR Apache-2.0 | 桌面端 |
| [serialize-to-javascript](https://github.com/chippers/serialize-to-javascript) | 0.1.2 | MIT OR Apache-2.0 | 桌面端 |
| [serialize-to-javascript-impl](https://github.com/chippers/serialize-to-javascript) | 0.1.2 | MIT OR Apache-2.0 | 桌面端 |
| [servo_arc](https://github.com/servo/stylo) | 0.4.3 | MIT OR Apache-2.0 | 桌面端 |
| [sha1](https://github.com/RustCrypto/hashes) | 0.10.7 | MIT OR Apache-2.0 | 桌面端、服务器、同步库 |
| [sha2](https://github.com/RustCrypto/hashes) | 0.10.9 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [shlex](https://github.com/comex/rust-shlex) | 2.0.1 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [simd-adler32](https://github.com/mcountryman/simd-adler32) | 0.3.10 | MIT | 桌面端 |
| [siphasher](https://github.com/jedisct1/rust-siphash) | 1.0.4 | MIT OR Apache-2.0 | 桌面端 |
| [slab](https://github.com/tokio-rs/slab) | 0.4.12 | MIT | 桌面端、服务器、知识库 |
| [smallvec](https://github.com/servo/rust-smallvec) | 1.16.4 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [snow](https://github.com/mcginty/snow) | 0.9.6 | Apache-2.0 OR MIT | 桌面端、服务器、同步库 |
| [socket2](https://github.com/rust-lang/socket2) | 0.6.5 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [softbuffer](https://github.com/rust-windowing/softbuffer) | 0.4.8 | MIT OR Apache-2.0 | 桌面端 |
| [stable_deref_trait](https://github.com/storyyeller/stable_deref_trait) | 1.2.1 | MIT OR Apache-2.0 | 桌面端、知识库 |
| [static_vcruntime](https://github.com/ChrisDenton/static_vcruntime) | 3.0.0 | MIT OR Apache-2.0 OR Zlib | 桌面端 |
| [string_cache](https://github.com/servo/string-cache) | 0.9.0 | MIT OR Apache-2.0 | 桌面端 |
| [string_cache_codegen](https://github.com/servo/string-cache) | 0.6.1 | MIT OR Apache-2.0 | 桌面端 |
| [strsim](https://github.com/rapidfuzz/strsim-rs) | 0.11.1 | MIT | 桌面端 |
| [subtle](https://github.com/dalek-cryptography/subtle) | 2.6.1 | BSD-3-Clause | 桌面端、服务器、同步库、知识库 |
| [swift-rs](https://github.com/Brendonovich/swift-rs) | 1.0.9 | MIT OR Apache-2.0 | 桌面端 |
| [syn](https://github.com/dtolnay/syn) | 2.0.119 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [syn](https://github.com/dtolnay/syn) | 3.0.9 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [sync_wrapper](https://github.com/Actyx/sync_wrapper) | 1.0.2 | Apache-2.0 | 桌面端、知识库 |
| [synstructure](https://github.com/mystor/synstructure) | 0.13.2 | MIT | 服务器 |
| [synstructure](https://github.com/mystor/synstructure) | 0.14.0 | MIT | 桌面端、知识库 |
| [system-configuration](https://github.com/mullvad/system-configuration-rs) | 0.7.0 | MIT OR Apache-2.0 | 桌面端、知识库 |
| [system-configuration-sys](https://github.com/mullvad/system-configuration-rs) | 0.6.0 | MIT OR Apache-2.0 | 桌面端、知识库 |
| [tao](https://github.com/tauri-apps/tao) | 0.37.2 | Apache-2.0 | 桌面端 |
| [tar](https://github.com/composefs/tar-rs) | 0.4.46 | MIT OR Apache-2.0 | 桌面端 |
| [tauri](https://github.com/tauri-apps/tauri) | 2.12.5 | Apache-2.0 OR MIT | 桌面端 |
| [tauri-build](https://github.com/tauri-apps/tauri) | 2.7.4 | Apache-2.0 OR MIT | 桌面端 |
| [tauri-codegen](https://github.com/tauri-apps/tauri) | 2.7.4 | Apache-2.0 OR MIT | 桌面端 |
| [tauri-macros](https://github.com/tauri-apps/tauri) | 2.7.4 | Apache-2.0 OR MIT | 桌面端 |
| [tauri-plugin](https://github.com/tauri-apps/tauri) | 2.7.2 | Apache-2.0 OR MIT | 桌面端 |
| [tauri-plugin-dialog](https://github.com/tauri-apps/plugins-workspace) | 2.8.4 | Apache-2.0 OR MIT | 桌面端 |
| [tauri-plugin-fs](https://github.com/tauri-apps/plugins-workspace) | 2.7.1 | Apache-2.0 OR MIT | 桌面端 |
| [tauri-plugin-global-shortcut](https://github.com/tauri-apps/plugins-workspace) | 2.4.1 | Apache-2.0 OR MIT | 桌面端 |
| [tauri-plugin-notification](https://github.com/tauri-apps/plugins-workspace) | 2.8.1 | Apache-2.0 OR MIT | 桌面端 |
| [tauri-plugin-single-instance](https://github.com/tauri-apps/plugins-workspace) | 2.5.5 | Apache-2.0 OR MIT | 桌面端 |
| [tauri-plugin-updater](https://github.com/tauri-apps/plugins-workspace) | 2.14.1 | Apache-2.0 OR MIT | 桌面端 |
| [tauri-runtime](https://github.com/tauri-apps/tauri) | 2.12.2 | Apache-2.0 OR MIT | 桌面端 |
| [tauri-runtime-wry](https://github.com/tauri-apps/tauri) | 2.12.3 | Apache-2.0 OR MIT | 桌面端 |
| [tauri-utils](https://github.com/tauri-apps/tauri) | 2.10.2 | Apache-2.0 OR MIT | 桌面端 |
| [tauri-winres](https://github.com/tauri-apps/winres) | 0.3.7 | MIT | 桌面端 |
| [tempfile](https://github.com/Stebalien/tempfile) | 3.27.0 | MIT OR Apache-2.0 | 桌面端 |
| [tendril](https://github.com/servo/html5ever) | 0.5.1 | MIT OR Apache-2.0 | 桌面端 |
| [thiserror](https://github.com/dtolnay/thiserror) | 1.0.69 | MIT OR Apache-2.0 | 服务器 |
| [thiserror](https://github.com/dtolnay/thiserror) | 2.0.21 | MIT OR Apache-2.0 | 桌面端、知识库 |
| [thiserror-impl](https://github.com/dtolnay/thiserror) | 1.0.69 | MIT OR Apache-2.0 | 服务器 |
| [thiserror-impl](https://github.com/dtolnay/thiserror) | 2.0.21 | MIT OR Apache-2.0 | 桌面端、知识库 |
| [time](https://github.com/time-rs/time) | 0.3.55 | MIT OR Apache-2.0 | 桌面端、服务器 |
| [time-core](https://github.com/time-rs/time) | 0.1.9 | MIT OR Apache-2.0 | 桌面端、服务器 |
| [time-macros](https://github.com/time-rs/time) | 0.2.32 | MIT OR Apache-2.0 | 桌面端、服务器 |
| [tinystr](https://github.com/unicode-org/icu4x) | 0.8.5 | Unicode-3.0 | 桌面端、知识库 |
| [tinyvec](https://github.com/Lokathor/tinyvec) | 1.13.3 | Zlib OR Apache-2.0 OR MIT | 桌面端、知识库 |
| [tokio](https://github.com/tokio-rs/tokio) | 1.54.1 | MIT | 桌面端、服务器、同步库、知识库 |
| [tokio-macros](https://github.com/tokio-rs/tokio) | 2.7.2 | MIT | 桌面端、服务器、同步库、知识库 |
| [tokio-rustls](https://github.com/rustls/tokio-rustls) | 0.26.6 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [tokio-util](https://github.com/tokio-rs/tokio) | 0.7.20 | MIT | 桌面端 |
| [toml](https://github.com/toml-rs/toml) | 1.1.8+spec-1.1.0 | MIT OR Apache-2.0 | 桌面端 |
| [toml_datetime](https://github.com/toml-rs/toml) | 1.1.2+spec-1.1.0 | MIT OR Apache-2.0 | 桌面端 |
| [toml_parser](https://github.com/toml-rs/toml) | 1.1.5+spec-1.1.0 | MIT OR Apache-2.0 | 桌面端 |
| [toml_writer](https://github.com/toml-rs/toml) | 1.1.3+spec-1.1.0 | MIT OR Apache-2.0 | 桌面端 |
| [tower](https://github.com/tower-rs/tower) | 0.5.3 | MIT | 桌面端、知识库 |
| [tower-http](https://github.com/tower-rs/tower-http) | 0.6.11 | MIT | 桌面端、知识库 |
| [tower-layer](https://github.com/tower-rs/tower) | 0.3.3 | MIT | 桌面端、知识库 |
| [tower-service](https://github.com/tower-rs/tower) | 0.3.3 | MIT | 桌面端、服务器、知识库 |
| [tracing](https://github.com/tokio-rs/tracing) | 0.1.44 | MIT | 桌面端、服务器、知识库 |
| [tracing-attributes](https://github.com/tokio-rs/tracing) | 0.1.31 | MIT | 桌面端、服务器、知识库 |
| [tracing-core](https://github.com/tokio-rs/tracing) | 0.1.36 | MIT | 桌面端、服务器、知识库 |
| [tray-icon](https://github.com/tauri-apps/tray-icon) | 0.25.1 | MIT OR Apache-2.0 | 桌面端 |
| [try-lock](https://github.com/seanmonstar/try-lock) | 0.2.5 | MIT | 桌面端、服务器、知识库 |
| [typed-path](https://github.com/chipsenkbeil/typed-path) | 0.13.0 | MIT OR Apache-2.0 | 桌面端 |
| [typeid](https://github.com/dtolnay/typeid) | 1.0.3 | MIT OR Apache-2.0 | 桌面端 |
| [typenum](https://github.com/paholg/typenum) | 1.20.1 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [unicode-ident](https://github.com/dtolnay/unicode-ident) | 1.0.27 | (MIT OR Apache-2.0) AND Unicode-3.0 | 桌面端、服务器、同步库、知识库 |
| [unicode-segmentation](https://github.com/unicode-rs/unicode-segmentation) | 1.13.3 | MIT OR Apache-2.0 | 桌面端 |
| [universal-hash](https://github.com/RustCrypto/traits) | 0.5.1 | MIT OR Apache-2.0 | 桌面端、服务器、同步库 |
| [untrusted](https://github.com/briansmith/untrusted) | 0.9.0 | ISC | 桌面端、服务器、知识库 |
| [url](https://github.com/servo/rust-url) | 2.5.8 | MIT OR Apache-2.0 | 桌面端、知识库 |
| [urlpattern](https://github.com/denoland/rust-urlpattern) | 0.6.0 | MIT | 桌面端 |
| [utf_types](https://github.com/hsivonen/utf_types) | 1.0.0 | Apache-2.0 OR MIT | 桌面端、知识库 |
| [utf8_iter](https://github.com/hsivonen/utf8_iter) | 1.1.0 | Apache-2.0 OR MIT | 桌面端、知识库 |
| [uuid](https://github.com/uuid-rs/uuid) | 1.29.0 | Apache-2.0 OR MIT | 桌面端、知识库 |
| [vcpkg](https://github.com/mcgoo/vcpkg-rs) | 0.2.15 | MIT/Apache-2.0 | 桌面端、服务器、知识库 |
| [version_check](https://github.com/SergioBenitez/version_check) | 0.9.5 | MIT/Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [vswhom](https://github.com/nabijaczleweli/vswhom.rs) | 0.1.0 | MIT | 桌面端 |
| [vswhom-sys](https://github.com/nabijaczleweli/vswhom-sys.rs) | 0.1.3 | MIT | 桌面端 |
| [walkdir](https://github.com/BurntSushi/walkdir) | 2.5.0 | Unlicense/MIT | 桌面端 |
| [want](https://github.com/seanmonstar/want) | 0.3.2 | MIT | 桌面端、服务器、知识库 |
| [web_atoms](https://github.com/servo/html5ever) | 0.2.6 | MIT OR Apache-2.0 | 桌面端 |
| [web-time](https://github.com/daxpedda/web-time) | 1.1.0 | MIT OR Apache-2.0 | 桌面端 |
| [webpki-roots](https://github.com/rustls/webpki-roots) | 1.0.11 | CDLA-Permissive-2.0 | 桌面端、知识库 |
| [webview2-com](https://github.com/wravery/webview2-rs) | 0.39.1 | MIT | 桌面端 |
| [webview2-com-macros](https://github.com/wravery/webview2-rs) | 0.8.1 | MIT | 桌面端 |
| [webview2-com-sys](https://github.com/wravery/webview2-rs) | 0.39.1 | MIT | 桌面端 |
| [winapi-util](https://github.com/BurntSushi/winapi-util) | 0.1.11 | Unlicense OR MIT | 桌面端 |
| [window-vibrancy](https://github.com/tauri-apps/tauri-plugin-vibrancy) | 0.8.1 | Apache-2.0 OR MIT | 桌面端 |
| [windows](https://github.com/microsoft/windows-rs) | 0.62.2 | MIT OR Apache-2.0 | 桌面端 |
| [windows_x86_64_msvc](https://github.com/microsoft/windows-rs) | 0.52.6 | MIT OR Apache-2.0 | 桌面端 |
| [windows_x86_64_msvc](https://github.com/microsoft/windows-rs) | 0.53.1 | MIT OR Apache-2.0 | 桌面端 |
| [windows-collections](https://github.com/microsoft/windows-rs) | 0.3.2 | MIT OR Apache-2.0 | 桌面端 |
| [windows-core](https://github.com/microsoft/windows-rs) | 0.62.2 | MIT OR Apache-2.0 | 桌面端 |
| [windows-future](https://github.com/microsoft/windows-rs) | 0.3.2 | MIT OR Apache-2.0 | 桌面端 |
| [windows-implement](https://github.com/microsoft/windows-rs) | 0.60.2 | MIT OR Apache-2.0 | 桌面端 |
| [windows-interface](https://github.com/microsoft/windows-rs) | 0.59.3 | MIT OR Apache-2.0 | 桌面端 |
| [windows-link](https://github.com/microsoft/windows-rs) | 0.2.1 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [windows-numerics](https://github.com/microsoft/windows-rs) | 0.3.1 | MIT OR Apache-2.0 | 桌面端 |
| [windows-registry](https://github.com/microsoft/windows-rs) | 0.6.1 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [windows-result](https://github.com/microsoft/windows-rs) | 0.4.1 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [windows-strings](https://github.com/microsoft/windows-rs) | 0.5.1 | MIT OR Apache-2.0 | 桌面端、服务器、知识库 |
| [windows-sys](https://github.com/microsoft/windows-rs) | 0.59.0 | MIT OR Apache-2.0 | 桌面端 |
| [windows-sys](https://github.com/microsoft/windows-rs) | 0.60.2 | MIT OR Apache-2.0 | 桌面端 |
| [windows-sys](https://github.com/microsoft/windows-rs) | 0.61.2 | MIT OR Apache-2.0 | 桌面端、服务器、同步库、知识库 |
| [windows-targets](https://github.com/microsoft/windows-rs) | 0.52.6 | MIT OR Apache-2.0 | 桌面端 |
| [windows-targets](https://github.com/microsoft/windows-rs) | 0.53.5 | MIT OR Apache-2.0 | 桌面端 |
| [windows-threading](https://github.com/microsoft/windows-rs) | 0.2.1 | MIT OR Apache-2.0 | 桌面端 |
| [windows-version](https://github.com/microsoft/windows-rs) | 0.1.7 | MIT OR Apache-2.0 | 桌面端 |
| [winnow](https://github.com/winnow-rs/winnow) | 1.0.4 | MIT | 桌面端 |
| [winreg](https://github.com/gentoo90/winreg-rs) | 0.56.0 | MIT | 桌面端 |
| [writeable](https://github.com/unicode-org/icu4x) | 0.6.4 | Unicode-3.0 | 桌面端、知识库 |
| [wry](https://github.com/tauri-apps/wry) | 0.57.1 | Apache-2.0 OR MIT | 桌面端 |
| [x509-parser](https://github.com/rusticata/x509-parser.git) | 0.16.0 | MIT OR Apache-2.0 | 服务器 |
| [xattr](https://github.com/Stebalien/xattr) | 1.7.0 | MIT OR Apache-2.0 | 桌面端 |
| [yasna](https://github.com/qnighy/yasna.rs) | 0.5.2 | MIT OR Apache-2.0 | 服务器 |
| [yoke](https://github.com/unicode-org/icu4x) | 0.8.4 | Unicode-3.0 | 桌面端、知识库 |
| [yoke-derive](https://github.com/unicode-org/icu4x) | 0.8.4 | Unicode-3.0 | 桌面端、知识库 |
| [zerocopy](https://github.com/google/zerocopy) | 0.8.63 | BSD-2-Clause OR Apache-2.0 OR MIT | 桌面端、服务器、知识库 |
| [zerofrom](https://github.com/unicode-org/icu4x) | 0.1.8 | Unicode-3.0 | 桌面端、知识库 |
| [zerofrom-derive](https://github.com/unicode-org/icu4x) | 0.1.8 | Unicode-3.0 | 桌面端、知识库 |
| [zeroize](https://github.com/RustCrypto/utils) | 1.9.1 | Apache-2.0 OR MIT | 桌面端、服务器、同步库、知识库 |
| [zerotrie](https://github.com/unicode-org/icu4x) | 0.2.5 | Unicode-3.0 | 桌面端、知识库 |
| [zerovec](https://github.com/unicode-org/icu4x) | 0.11.9 | Unicode-3.0 | 桌面端、知识库 |
| [zerovec-derive](https://github.com/unicode-org/icu4x) | 0.11.7 | Unicode-3.0 | 桌面端、知识库 |
| [zip](https://github.com/zip-rs/zip2) | 9.4.1 | MIT | 桌面端 |
| [zlib-rs](https://github.com/trifectatechfoundation/zlib-rs) | 0.6.8 | Zlib | 桌面端 |
| [zmij](https://github.com/dtolnay/zmij) | 1.0.23 | MIT | 桌面端、服务器、同步库、知识库 |
| [zopfli](https://github.com/zopfli-rs/zopfli) | 0.8.4 | Apache-2.0 | 桌面端 |
| [zune-core](https://github.com/etemesi254/zune-image) | 0.5.3 | MIT OR Apache-2.0 OR Zlib | 桌面端 |
| [zune-jpeg](https://github.com/etemesi254/zune-image/tree/dev/crates/zune-jpeg) | 0.5.15 | MIT OR Apache-2.0 OR Zlib | 桌面端 |

## npm 依赖（40 个）

打进电脑端界面和手机网页的包，以及它们用到的包。

| 名字 | 版本 | 许可证 |
| --- | --- | --- |
| [@codemirror/autocomplete](https://www.npmjs.com/package/@codemirror/autocomplete) | 6.20.4 | MIT |
| [@codemirror/commands](https://www.npmjs.com/package/@codemirror/commands) | 6.11.1 | MIT |
| [@codemirror/lang-css](https://www.npmjs.com/package/@codemirror/lang-css) | 6.3.1 | MIT |
| [@codemirror/lang-html](https://www.npmjs.com/package/@codemirror/lang-html) | 6.4.12 | MIT |
| [@codemirror/lang-javascript](https://www.npmjs.com/package/@codemirror/lang-javascript) | 6.2.5 | MIT |
| [@codemirror/lang-markdown](https://www.npmjs.com/package/@codemirror/lang-markdown) | 6.5.2 | MIT |
| [@codemirror/language](https://www.npmjs.com/package/@codemirror/language) | 6.13.1 | MIT |
| [@codemirror/lint](https://www.npmjs.com/package/@codemirror/lint) | 6.9.7 | MIT |
| [@codemirror/search](https://www.npmjs.com/package/@codemirror/search) | 6.7.2 | MIT |
| [@codemirror/state](https://www.npmjs.com/package/@codemirror/state) | 6.7.6 | MIT |
| [@codemirror/streamparser](https://www.npmjs.com/package/@codemirror/streamparser) | 6.0.0 | MIT |
| [@codemirror/view](https://www.npmjs.com/package/@codemirror/view) | 6.43.15 | MIT |
| [@lezer/common](https://www.npmjs.com/package/@lezer/common) | 1.5.5 | MIT |
| [@lezer/css](https://www.npmjs.com/package/@lezer/css) | 1.3.9 | MIT |
| [@lezer/highlight](https://www.npmjs.com/package/@lezer/highlight) | 1.2.5 | MIT |
| [@lezer/html](https://www.npmjs.com/package/@lezer/html) | 1.3.13 | MIT |
| [@lezer/javascript](https://www.npmjs.com/package/@lezer/javascript) | 1.5.6 | MIT |
| [@lezer/lr](https://www.npmjs.com/package/@lezer/lr) | 1.4.12 | MIT |
| [@lezer/markdown](https://www.npmjs.com/package/@lezer/markdown) | 1.8.1 | MIT |
| [@marijn/find-cluster-break](https://www.npmjs.com/package/@marijn/find-cluster-break) | 1.0.4 | MIT |
| [@noble/ciphers](https://www.npmjs.com/package/@noble/ciphers) | 2.4.0 | MIT |
| [@tauri-apps/api](https://www.npmjs.com/package/@tauri-apps/api) | 2.12.4 | Apache-2.0 OR MIT |
| [@types/react](https://www.npmjs.com/package/@types/react) | 19.3.0 | MIT |
| [clsx](https://www.npmjs.com/package/clsx) | 2.1.1 | MIT |
| [cookie](https://www.npmjs.com/package/cookie) | 1.1.1 | MIT |
| [crelt](https://www.npmjs.com/package/crelt) | 1.0.7 | MIT |
| [csstype](https://www.npmjs.com/package/csstype) | 3.2.3 | MIT |
| [hash-wasm](https://www.npmjs.com/package/hash-wasm) | 4.12.0 | MIT |
| [lucide](https://www.npmjs.com/package/lucide) | 0.460.0 | ISC |
| [lucide-react](https://www.npmjs.com/package/lucide-react) | 1.72.0 | ISC |
| [qrcode-generator](https://www.npmjs.com/package/qrcode-generator) | 1.4.4 | MIT |
| [react](https://www.npmjs.com/package/react) | 19.3.1 | MIT |
| [react-dom](https://www.npmjs.com/package/react-dom) | 19.3.1 | MIT |
| [react-router](https://www.npmjs.com/package/react-router) | 7.18.5 | MIT |
| [react-router-dom](https://www.npmjs.com/package/react-router-dom) | 7.18.5 | MIT |
| [scheduler](https://www.npmjs.com/package/scheduler) | 0.28.0 | MIT |
| [set-cookie-parser](https://www.npmjs.com/package/set-cookie-parser) | 2.7.3 | MIT |
| [sonner](https://www.npmjs.com/package/sonner) | 2.0.8 | MIT |
| [style-mod](https://www.npmjs.com/package/style-mod) | 4.1.4 | MIT |
| [w3c-keyname](https://www.npmjs.com/package/w3c-keyname) | 2.2.8 | MIT |
