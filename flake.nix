{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    nur = {
      url = "github:nix-community/NUR";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    trevnur = {
      url = "github:spotdemo4/nur";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.nur.follows = "nur";
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

  outputs = {
    nixpkgs,
    nur,
    trevnur,
    ags,
    ...
  }: let
    build-systems = [
      "x86_64-linux"
      "aarch64-linux"
      "aarch64-darwin"
    ];
    forSystem = f:
      nixpkgs.lib.genAttrs build-systems (
        system:
          f rec {
            inherit system;

            pkgs = import nixpkgs {
              inherit system;
              overlays = [nur.overlays.default];
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

            extraPackages = with pkgs;
              [
                libgtop
                libsoup_3
              ]
              ++ astalPackages;
          }
      );

    trevbar = forSystem (
      {
        system,
        pkgs,
        extraPackages,
        ...
      }:
        pkgs.buildNpmPackage (finalAttrs: {
          pname = "trevbar";
          version = "0.0.7";
          src = ./.;
          nodejs = pkgs.nodejs_22;

          npmDeps = pkgs.importNpmLock {
            npmRoot = ./.;
            packageSourceOverrides = {
              "node_modules/ags" = ags.packages.${system}.default;
            };
          };

          npmConfigHook = pkgs.importNpmLock.npmConfigHook;

          nativeBuildInputs = with pkgs; [
            wrapGAppsHook
            gobject-introspection
            ags.packages.${system}.default
          ];

          buildInputs = extraPackages ++ [pkgs.gjs];

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
            description = "Trev's AGS bar";
            homepage = "https://github.com/spotdemo4/trevbar";
            license = pkgs.lib.licenses.mit;
            platforms = pkgs.lib.platforms.all;
          };
        })
    );
  in rec {
    devShells = forSystem ({
      pkgs,
      system,
      extraPackages,
      ...
    }: {
      default = pkgs.mkShell {
        buildInputs = [
          (ags.packages.${system}.default.override {
            inherit extraPackages;
          })
        ];
        packages = with pkgs; [
          git
          trevnur.packages."${system}".bumper

          # Build
          nodejs_22

          # Nix
          nix-update
          alejandra

          # Actions
          renovate
          action-validator
        ];
        shellHook = ''
          echo "nix flake check --accept-flake-config" > .git/hooks/pre-push
          chmod +x .git/hooks/pre-push
        '';
      };
    });

    checks = forSystem ({
      system,
      pkgs,
      ...
    }:
      pkgs.nur.repos.trev.lib.mkChecks {
        lint = {
          src = ./.;
          nativeBuildInputs = with pkgs; [
            alejandra
            renovate
            action-validator
          ];
          checkPhase = ''
            alejandra -c .
            renovate-config-validator
            action-validator .github/workflows/*
          '';
        };
      }
      // {
        build = trevbar."${system}".overrideAttrs {
          doCheck = true;
          checkPhase = ''
            npx prettier --check .
            npx eslint .
          '';
          installPhase = ''
            touch $out
          '';
        };
        shell = devShells."${system}".default;
      });

    packages = forSystem ({system, ...}: {
      default = trevbar."${system}";
    });
  };
}
