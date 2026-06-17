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
    trevpkgs = {
      url = "github:spotdemo4/trevpkgs";
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
      trevpkgs,
      ags,
      ...
    }:
    trevpkgs.libs.mkFlake (
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

        agsFull = ags.packages.${system}.default.override {
          inherit extraPackages;
        };
      in
      {
        devShells = {
          default = pkgs.mkShell {
            shellHook = pkgs.shellhook.ref;
            buildInputs = [ agsFull ];
            packages = with pkgs; [
              nodejs_24

              # deps
              nvtopPackages.intel
              lm_sensors
              systemd

              # lint
              oxlint
              nixd
              nil

              # format
              oxfmt
              nixfmt
              treefmt

              # util
              bumper
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
            buildInputs = [ agsFull ];
            packages = with pkgs; [
              renovate
              nodejs_24 # npm install / audit
            ];
          };

          vulnerable = pkgs.mkShell {
            packages = with pkgs; [
              nodejs_24 # npm audit
              flake-checker # nix
              zizmor # actions
            ];
          };
        };

        apps = pkgs.mkApps {
          dev = "npm run dev";
          configure = "npm run configure";
        };

        checks = pkgs.mkChecks {
          trevbar = self.packages.${system}.default.overrideAttrs {
            dontBuild = true;
            installPhase = ''
              touch $out
            '';
          };

          nix = {
            root = ./.;
            filter = file: file.hasExt "nix";
            packages = with pkgs; [
              nixfmt
            ];
            script = ''
              nixfmt --check "$file"
            '';
          };

          actions-gh = {
            root = ./.github/workflows;
            filter = file: file.hasExt "yaml";
            packages = with pkgs; [
              action-validator
              zizmor
            ];
            script = ''
              action-validator "$file"
              zizmor --offline "$file"
            '';
          };

          actions-fj = {
            root = ./.forgejo/workflows;
            filter = file: file.hasExt "yaml";
            packages = with pkgs; [
              forgejo-runner
              zizmor
            ];
            script = ''
              forgejo-runner validate --workflow --path "$file"
              zizmor --offline "$file"
            '';
          };

          renovate = {
            root = ./.forgejo;
            files = ./.forgejo/renovate.json;
            packages = with pkgs; [
              renovate
            ];
            script = ''
              renovate-config-validator renovate.json
            '';
          };

          config = {
            root = ./.;
            filter = file: file.hasExt "json" || file.hasExt "yaml" || file.hasExt "toml" || file.hasExt "md";
            packages = with pkgs; [
              oxfmt
            ];
            script = ''
              oxfmt --check
            '';
          };
        };

        packages.default =
          with pkgs.lib;
          pkgs.buildNpmPackage (final: {
            pname = "trevbar";
            version = "0.5.3";
            nodejs = pkgs.nodejs_24;

            src = fileset.toSource {
              root = ./.;
              fileset = fileset.unions [
                ./.npmrc
                ./.oxfmtrc.json
                ./.oxlintrc.json
                ./env.d.ts
                ./LICENSE
                ./package.json
                ./package-lock.json
                ./README.md
                ./tsconfig.json
                ./icons
                ./src
                ./utils
              ];
            };

            npmDeps = pkgs.importNpmLock {
              npmRoot = ./.;
              packageSourceOverrides = {
                "node_modules/ags" = "${agsFull}/share/ags/js";
              };
            };
            npmConfigHook = pkgs.importNpmLock.npmConfigHook;

            nativeBuildInputs = with pkgs; [
              wrapGAppsHook3
              gobject-introspection
              agsFull
            ];
            buildInputs =
              with pkgs;
              [
                nvtopPackages.intel
                lm_sensors
              ]
              ++ extraPackages;
            buildPhase = ''
              ags types -u -d .
            '';
            dontNpmBuild = true;

            nativeCheckInputs = with pkgs; [
              oxfmt
              oxlint
            ];
            checkPhase = ''
              oxfmt --check
              oxlint --deny-warnings
            '';

            installPhase = ''
              runHook preInstall
              mkdir -p $out/bin $out/share
              cp -r * $out/share
              ags bundle src/app.tsx $out/bin/${final.pname} -d "SRC='$out/share'" --gtk 4
              runHook postInstall
            '';

            preFixup = ''
              gappsWrapperArgs+=(
                --prefix PATH : "${pkgs.nvtopPackages.intel}/bin"
                --prefix PATH : "${pkgs.lm_sensors}/bin"
                --prefix PATH : "${pkgs.systemd}/bin"
                --prefix PATH : "${pkgs.coreutils}/bin"
              )
            '';

            meta = {
              description = "Trev's status bar";
              mainProgram = "trevbar";
              license = licenses.mit;
              platforms = platforms.unix;
              homepage = "https://trev.zip/trev/trevbar";
              changelog = "https://trev.zip/trev/trevbar/releases/tag/v${final.version}";
              downloadPage = "https://trev.zip/trev/trevbar/releases";
            };
          });

        formatter = pkgs.treefmt.withConfig {
          configFile = ./treefmt.toml;
          runtimeInputs = with pkgs; [
            oxfmt
            nixfmt
          ];
        };
      }
    );
}
