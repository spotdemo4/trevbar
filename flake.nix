{
  description = "trevbar";

  nixConfig = {
    extra-substituters = [
      "https://nix.trev.zip"
    ];
    extra-trusted-public-keys = [
      "trev:I39N/EsnHkvfmsbx8RUW+ia5dOzojTQNCTzKYij1chU="
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
      trev,
      ags,
      ...
    }:
    trev.libs.mkFlake (
      system: pkgs:
      let
        astalPackages = with ags.packages.${system}; [
          astal4
          battery
          bluetooth
          hyprland
          io
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

        deps = with pkgs; [
          nvtopPackages.intel
        ];

        node = pkgs.nodejs_24;

        fs = pkgs.lib.fileset;
      in
      rec {
        devShells = {
          default = pkgs.mkShell {
            buildInputs = [
              (ags.packages.${system}.default.override {
                inherit extraPackages;
              })
            ];
            packages =
              with pkgs;
              [
                node

                # format
                nixfmt

                # util
                bumper
                flake-release
                renovate
              ]
              ++ deps;
            shellHook = pkgs.shellhook.ref;
          };

          bump = pkgs.mkShell {
            packages = with pkgs; [
              bumper
            ];
          };

          release = pkgs.mkShell {
            packages = with pkgs; [
              flake-release
            ];
          };

          update = pkgs.mkShell {
            packages = with pkgs; [
              renovate

              # npm i
              node
            ];
          };

          vulnerable = pkgs.mkShell {
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

        checks = pkgs.mkChecks {
          trevbar = {
            src = packages.default;
            script = ''
              npx prettier --check .
              npx eslint --flag unstable_native_nodejs_ts_config .
            '';
          };

          nix = {
            root = ./.;
            filter = file: file.hasExt "nix";
            deps = with pkgs; [
              nixfmt
            ];
            forEach = ''
              nixfmt --check "$file"
            '';
          };

          renovate = {
            root = ./.github;
            fileset = ./.github/renovate.json;
            deps = with pkgs; [
              renovate
            ];
            script = ''
              renovate-config-validator renovate.json
            '';
          };

          actions = {
            root = ./.github/workflows;
            deps = with pkgs; [
              action-validator
              octoscan
            ];
            forEach = ''
              action-validator "$file"
              octoscan scan "$file"
            '';
          };
        };

        packages.default = pkgs.buildNpmPackage (finalAttrs: {
          pname = "trevbar";
          version = "0.3.1";

          src = fs.toSource {
            root = ./.;
            fileset = fs.difference ./. (
              fs.unions [
                ./.github
                ./.vscode
                ./flake.nix
                ./flake.lock
              ]
            );
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

          buildInputs = [
            pkgs.gjs
          ]
          ++ extraPackages
          ++ deps;

          doCheck = false;
          dontNpmBuild = true;

          installPhase = ''
            runHook preInstall

            mkdir -p $out/bin
            mkdir -p $out/share
            cp -r * $out/share
            ags bundle app.tsx $out/bin/${finalAttrs.pname} -d "SRC='$out/share'" --gtk 4

            runHook postInstall
          '';

          preFixup = ''
            gappsWrapperArgs+=(
              --prefix PATH : "${pkgs.nvtopPackages.intel}/bin"
            )
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
