{
  description = "Trevbar";

  nixConfig = {
    extra-substituters = [
      "https://cache.trev.zip/nur"
    ];
    extra-trusted-public-keys = [
      "nur:70xGHUW1+1b8FqBchldaunN//pZNVo6FKuPL4U/n844="
    ];
  };

  inputs = {
    systems.url = "systems";
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    utils = {
      url = "github:numtide/flake-utils";
      inputs.systems.follows = "systems";
    };
    nur = {
      url = "github:nix-community/NUR";
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

  outputs = {
    nixpkgs,
    utils,
    nur,
    ags,
    ...
  }:
    utils.lib.eachDefaultSystem (system: let
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
    in rec {
      devShells.default = pkgs.mkShell {
        buildInputs = [
          (ags.packages.${system}.default.override {
            inherit extraPackages;
          })
        ];
        packages = with pkgs; [
          git
          pkgs.nur.repos.trev.bumper

          # Build
          nodejs_22

          # Nix
          nix-update
          alejandra

          # Actions
          action-validator
          pkgs.nur.repos.trev.renovate
        ];
        shellHook = pkgs.nur.repos.trev.shellhook.ref;
      };

      checks =
        pkgs.nur.repos.trev.lib.mkChecks {
          lint = {
            src = ./.;
            nativeBuildInputs = with pkgs; [
              alejandra
              action-validator
              pkgs.nur.repos.trev.renovate
            ];
            checkPhase = ''
              alejandra -c .
              renovate-config-validator
              action-validator .github/workflows/*
            '';
          };
        }
        // {
          build = packages.default.overrideAttrs {
            doCheck = true;
            checkPhase = ''
              npx prettier --check .
              npx eslint .
            '';
            installPhase = ''
              touch $out
            '';
          };
          shell = devShells.default;
        };

      packages.default = pkgs.buildNpmPackage (
        finalAttrs: {
          pname = "trevbar";
          version = "0.1.10";
          src = ./.;
          nodejs = pkgs.nodejs_24;

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
        }
      );

      formatter = pkgs.alejandra;
    });
}
