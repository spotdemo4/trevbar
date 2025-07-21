{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
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
    nur,
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
        pkgs,
        extraPackages,
        ...
      }:
        pkgs.buildNpmPackage (finalAttrs: {
          pname = "trevbar";
          version = "0.0.1";
          src = ./.;
          npmDepsHash = "sha256-sBG/Bdu/pzOyMlN6qCC4r2FDuZ8flyQL2SWJiWAk4zE=";
          patchFlags = ["--log-level=verbose"];

          nativeBuildInputs = with pkgs; [
            wrapGAppsHook
            gobject-introspection
            ags.packages.${system}.default
          ];

          buildInputs = extraPackages ++ [pkgs.gjs];

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
    # pkgs.stdenv.mkDerivation {
    #   name = pname;
    #   src = ./.;
    #   nativeBuildInputs = with pkgs; [
    #     wrapGAppsHook
    #     gobject-introspection
    #     ags.packages.${system}.default
    #   ];
    #   buildInputs = extraPackages ++ [pkgs.gjs];
    #   installPhase = ''
    #     runHook preInstall
    #     mkdir -p $out/bin
    #     mkdir -p $out/share
    #     cp -r * $out/share
    #     ags bundle ${entry} $out/bin/${pname} -d "SRC='$out/share'"
    #     runHook postInstall
    #   '';
    # }
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
          nodejs_24
          renovate
        ];
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
          ];
          checkPhase = ''
            alejandra -c .
          '';
        };
      }
      // {
        build = trevbar."${system}".overrideAttrs {
          doCheck = true;
          checkPhase = ''
            npx prettier --check .
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
