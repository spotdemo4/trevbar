# contributing

## requirements

- [nix](https://nixos.org/)

## getting started

```sh
nix develop
```

with [direnv](https://direnv.net/):

```sh
ln -s .envrc.project .envrc
direnv allow
```

install dependencies and generate types:

```sh
npm install
npm run configure
```

### run

```sh
nix run
```

with [ags](https://aylur.github.io/ags/):

```sh
npm run dev
```

### format

```sh
nix fmt
```

with [oxfmt](https://oxc.rs/):

```sh
oxfmt --write .
```

### check

```sh
nix flake check
```

with [oxlint](https://oxc.rs/):

```sh
oxlint --deny-warnings
```

### build

```sh
nix build
```

### release

with [bumper](https://trev.zip/llc/bumper):

```sh
bumper
```

releases are automatically created for [significant](https://www.conventionalcommits.org/en/v1.0.0/#summary) changes
