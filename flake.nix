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
    systems.url = "github:spotdemo4/systems";
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
      self,
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
      in
      {
        devShells = {
          default = pkgs.mkShell {
            shellHook = pkgs.shellhook.ref;
            buildInputs = [
              (ags.packages.${system}.default.override {
                inherit extraPackages;
              })
            ];
            packages = with pkgs; [
              nodejs_24

              # deps
              nvtopPackages.intel
              lm_sensors

              # format
              nixfmt

              # util
              bumper
              flake-release
              renovate
            ];
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
              nodejs_24 # npm i
            ];
          };

          vulnerable = pkgs.mkShell {
            packages = with pkgs; [
              nodejs_24 # npm audit
              flake-checker # nix
              octoscan # actions
            ];
          };
        };

        checks = pkgs.mkChecks {
          trevbar = {
            src = self.packages.${system}.default;
            script = ''
              npx prettier --check .
              npx eslint --flag unstable_native_nodejs_ts_config .
            '';
          };

          nix = {
            root = ./.;
            filter = file: file.hasExt "nix";
            packages = with pkgs; [
              nixfmt
            ];
            forEach = ''
              nixfmt --check "$file"
            '';
          };

          renovate = {
            root = ./.github;
            fileset = ./.github/renovate.json;
            packages = with pkgs; [
              renovate
            ];
            script = ''
              renovate-config-validator renovate.json
            '';
          };

          actions = {
            root = ./.github/workflows;
            packages = with pkgs; [
              action-validator
              octoscan
            ];
            forEach = ''
              action-validator "$file"
              octoscan scan "$file"
            '';
          };
        };

        packages.default =
          with pkgs.lib;
          pkgs.buildNpmPackage (finalAttrs: {
            pname = "trevbar";
            version = "0.5.0";
            nodejs = pkgs.nodejs_24;

            src = fileset.toSource {
              root = ./.;
              fileset = fileset.unions [
                ./.gitignore
                ./.npmrc
                ./env.d.ts
                ./eslint.config.ts
                ./package.json
                ./package-lock.json
                ./prettier.config.ts
                ./tsconfig.json
                ./icons
                ./src
                ./utils
              ];
            };

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

            buildInputs =
              with pkgs;
              [
                gjs
                nvtopPackages.intel
                lm_sensors
              ]
              ++ extraPackages;

            doCheck = false;
            dontNpmBuild = true;

            installPhase = ''
              runHook preInstall

              mkdir -p $out/bin $out/share
              cp -r * $out/share
              ags bundle src/app.tsx $out/bin/${finalAttrs.pname} -d "SRC='$out/share'" --gtk 4

              runHook postInstall
            '';

            preFixup = ''
              gappsWrapperArgs+=(
                --prefix PATH : "${pkgs.nvtopPackages.intel}/bin"
                --prefix PATH : "${pkgs.lm_sensors}/bin"
              )
            '';

            meta = {
              description = "Trev's status bar";
              mainProgram = "trevbar";
              license = licenses.mit;
              platforms = platforms.unix;
              homepage = "https://github.com/spotdemo4/trevbar";
              changelog = "https://github.com/spotdemo4/trevbar/releases/tag/v${finalAttrs.version}";
            };
          });

        formatter = pkgs.nixfmt-tree;
      }
    );
}
