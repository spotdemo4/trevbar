{
  description = "trevbar";

  nixConfig = {
    extra-substituters = [
      "https://cache.trev.zip/nur"
    ];
    extra-trusted-public-keys = [
      "nur:70xGHUW1+1b8FqBchldaunN//pZNVo6FKuPL4U/n844="
    ];
  };

  inputs = {
    systems.url = "github:nix-systems/default";
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    trev = {
      url = "github:spotdemo4/nur";
      inputs.systems.follows = "systems";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    astal = {
      url = "github:aylur/astal";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    ags = {
      url = "github:aylur/ags";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.astal.follows = "astal";
    };
  };

  outputs =
    {
      nixpkgs,
      trev,
      ags,
      ...
    }:
    trev.libs.mkFlake (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [
            trev.overlays.packages
            trev.overlays.libs
          ];
        };

        astalPackages = with ags.packages.${system}; [
          io
          astal4
          battery
          bluetooth
          hyprland
          mpris
          network
          tray
          wireplumber
        ];

        extraPackages =
          with pkgs;
          [
            libgtop
            libsoup_3
          ]
          ++ astalPackages;

        node = pkgs.nodejs_24;
      in
      rec {
        devShells = {
          default = pkgs.mkShell {
            name = "default";
            buildInputs = [
              (ags.packages.${system}.default.override {
                inherit extraPackages;
              })
            ];
            packages = with pkgs; [
              node

              # nix
              nixfmt
            ];
            shellHook = pkgs.shellhook.ref;
          };

          update = pkgs.mkShell {
            name = "update";
            packages = with pkgs; [
              renovate
            ];
          };

          vulnerable = pkgs.mkShell {
            name = "vulnerable";
            packages = with pkgs; [
              # npm audit
              node

              # nix
              flake-checker

              # actions
              octoscan
            ];
          };
        };

        checks = pkgs.lib.mkChecks {
          trevbar = {
            src = packages.default;
            script = ''
              npx prettier --check .
              npx eslint --flag unstable_native_nodejs_ts_config .
            '';
          };

          nix = {
            src = ./.;
            deps = with pkgs; [
              nixfmt-tree
            ];
            script = ''
              treefmt --ci
            '';
          };

          actions = {
            src = ./.;
            deps = with pkgs; [
              action-validator
              octoscan
              renovate
            ];
            script = ''
              action-validator .github/**/*.yaml
              octoscan scan .github
              renovate-config-validator .github/renovate.json
            '';
          };
        };

        packages.default = pkgs.buildNpmPackage (finalAttrs: {
          pname = "trevbar";
          version = "0.1.15";

          src = builtins.path {
            name = "root";
            path = ./.;
          };
          nodejs = node;

          npmDeps = pkgs.importNpmLock {
            npmRoot = ./.;
            packageSourceOverrides = {
              "node_modules/ags" = ags.packages.${system}.default;
            };
          };

          npmConfigHook = pkgs.importNpmLock.npmConfigHook;

          nativeBuildInputs = with pkgs; [
            wrapGAppsHook3
            gobject-introspection
            ags.packages.${system}.default
          ];

          buildInputs = extraPackages ++ [ pkgs.gjs ];

          doCheck = false;
          dontNpmBuild = true;

          installPhase = ''
            runHook preInstall

            mkdir -p $out/bin
            mkdir -p $out/share
            cp -r * $out/share
            ags bundle app.ts $out/bin/${finalAttrs.pname} -d "SRC='$out/share'"

            runHook postInstall
          '';

          meta = {
            description = "Trev's status bar";
            mainProgram = "trevbar";
            homepage = "https://github.com/spotdemo4/trevbar";
            changelog = "https://github.com/spotdemo4/trevbar/releases/tag/v${finalAttrs.version}";
            license = pkgs.lib.licenses.mit;
            platforms = pkgs.lib.platforms.all;
          };
        });

        formatter = pkgs.nixfmt-tree;
      }
    );
}
