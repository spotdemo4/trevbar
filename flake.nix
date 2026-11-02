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
      url = "github:spotdemo4/astal";
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

        fontConfig = pkgs.makeFontsConf {
          fontDirectories = [ pkgs.inter ];
        };
      in
      {

        # nix develop [#...]
        devShells = {
          default = pkgs.mkShell {
            shellHook = pkgs.shellhook.ref;
            buildInputs = [ agsFull ];
            packages = with pkgs; [
              # node
              nodejs_26
              oxlint
              typescript

              # deps
              nvtopPackages.intel
              lm_sensors
              systemd

              vscode-json-languageserver # json
              yaml-language-server # yaml
              tombi # toml
              oxfmt # format

              # nix
              nixd
              nixfmt

              # util
              treefmt
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
              nodejs_26 # npm install
            ];
          };

          vulnerable = pkgs.mkShell {
            packages = with pkgs; [
              nodejs_26 # npm audit
              flake-checker # nix
              zizmor # actions
            ];
          };
        };

        # nix run #...
        apps = pkgs.mkApps {
          dev = "npm run dev";
          configure = "npm run configure";
        };

        # nix build [#...]
        packages = {
          default = pkgs.buildNpmPackage (
            final: with pkgs.lib; {
              pname = "trevbar";
              version = "0.8.6";

              src = fileset.toSource {
                root = ./.;
                fileset = fileset.unions [
                  ./.npmrc
                  ./.oxfmtrc.json
                  ./.oxlintrc.json
                  ./env.d.ts
                  ./icons
                  ./LICENSE
                  ./package-lock.json
                  ./package.json
                  ./README.md
                  ./src
                  ./tsconfig.json
                  ./utils
                ];
              };

              nodejs = pkgs.nodejs_26;
              npmConfigHook = pkgs.importNpmLock.npmConfigHook;
              npmDeps = pkgs.importNpmLock {
                npmRoot = final.src;
                packageSourceOverrides = {
                  "node_modules/ags" = "${agsFull}/share/ags/js";
                };
              };

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
              dontNpmBuild = true;

              installPhase = ''
                runHook preInstall
                mkdir -p $out/bin $out/share
                cp -r * $out/share
                ags bundle src/app.tsx $out/bin/${final.pname} -d "SRC='$out/share'" --gtk 4
                runHook postInstall
              '';

              preFixup = ''
                gappsWrapperArgs+=(
                  --set FONTCONFIG_FILE "${fontConfig}"
                  --prefix PATH : "${pkgs.nvtopPackages.intel}/bin"
                  --prefix PATH : "${pkgs.lm_sensors}/bin"
                  --prefix PATH : "${pkgs.systemd}/bin"
                  --prefix PATH : "${pkgs.coreutils}/bin"
                )
              '';

              meta = {
                mainProgram = "trevbar";
                description = "Trev's status bar";
                license = licenses.mit;
                platforms = platforms.unix;
                homepage = "https://trev.zip/llc/trevbar";
                downloadPage = "https://trev.zip/llc/trevbar/releases";
                changelog = "https://trev.zip/llc/trevbar/releases/tag/v${final.version}";
                sourceProvenance = [ sourceTypes.fromSource ];
                maintainers = [ maintainers.spotdemo4 ];
              };
            }
          );
        };

        # nix fmt
        formatter = pkgs.treefmt.withConfig {
          configFile = ./treefmt.toml;
          runtimeInputs = with pkgs; [
            oxfmt
            nixfmt
          ];
        };

        # nix flake check
        checks = pkgs.mkChecks {
          inherit (self.packages.${system}) default;

          node-lint = {
            src = self.packages.${system}.default;
            packages = with pkgs; [
              oxfmt
              oxlint
            ];
            script = ''
              oxfmt --check
              ags types -u -d .
              oxlint --deny-warnings
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

          renovate-fj = {
            root = ./.forgejo;
            files = ./.forgejo/renovate.jsonc;
            packages = with pkgs; [
              renovate
            ];
            script = ''
              renovate-config-validator renovate.jsonc
            '';
          };

          config = {
            root = ./.;
            filter =
              file:
              file.hasExt "json"
              || file.hasExt "jsonc"
              || file.hasExt "yaml"
              || file.hasExt "toml"
              || file.hasExt "md";
            include = [ ./.oxfmtrc.json ];
            packages = with pkgs; [
              oxfmt
            ];
            script = ''
              oxfmt --check
            '';
          };
        };
      }
    );
}
