# trevbar

[![check](https://trev.zip/trev/trevbar/actions/workflows/check.yaml/badge.svg?branch=main&logo=forgejo&logoColor=%23bac2de&label=check&labelColor=%23313244)](https://trev.zip/trev/trevbar/actions?workflow=check.yaml)
[![vulnerable](https://trev.zip/trev/trevbar/actions/workflows/vulnerable.yaml/badge.svg?branch=main&logo=forgejo&logoColor=%23bac2de&label=vulnerable&labelColor=%23313244)](https://trev.zip/trev/trevbar/actions?workflow=vulnerable.yaml)
[![node](https://img.shields.io/badge/dynamic/json?url=https://trev.zip/trev/trevbar/raw/branch/main/package.json&query=%24.engines.node&logo=nodedotjs&logoColor=%23bac2de&label=version&labelColor=%23313244&color=%23339933)](https://nodejs.org/en/about/previous-releases)

Trev's [AGS](https://aylur.github.io/ags/) status bar.

## requirements

- [nix](https://nixos.org/)

## getting started

```sh
nix develop && npm install
```

### run

```sh
nix run .#dev
```

### format

```sh
nix fmt
```

### check

```sh
nix flake check
```

### build

```sh
nix build
```

### release

```sh
bumper
```

releases are automatically created for [significant](https://www.conventionalcommits.org/en/v1.0.0/#summary) changes.

## use

```sh
nix run git+https://trev.zip/trev/trevbar.git
```

### download

https://trev.zip/trev/trevbar/releases
