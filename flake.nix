{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    ags = {
      url = "github:aylur/ags";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    astal = {
      url = "github:aylur/astal";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = {
    self,
    nixpkgs,
    astal,
    ags,
  }: let
    pname = "trevbar";
    version = "0.0.1";

    build-systems = [
      "x86_64-linux"
      "aarch64-linux"
      "x86_64-darwin"
      "aarch64-darwin"
    ];
    forSystem = f:
      nixpkgs.lib.genAttrs build-systems (
        system:
          f {
            inherit system;
            pkgs = import nixpkgs {
              inherit system;
            };
          }
      );
  in {
    # Dev environment
    devShells = forSystem ({
      pkgs,
      system,
      ...
    }: {
      default = pkgs.mkShell {
        packages = with pkgs; [
          nodejs_22
        ];

        buildInputs = [
          # includes astal3 astal4 astal-io by default
          (ags.packages.${system}.default.override {
            extraPackages = [
              ags.packages.${system}.hyprland
              ags.packages.${system}.tray
              ags.packages.${system}.network
              ags.packages.${system}.battery
              ags.packages.${system}.mpris
              ags.packages.${system}.wireplumber
              ags.packages.${system}.bluetooth
              pkgs.libgtop
              pkgs.libsoup_3
            ];
          })
          (astal.packages.${system}.default)
        ];
      };
    });

    # Package
    packages = forSystem ({
      pkgs,
      system,
      ...
    }: {
      default = ags.lib.bundle {
        inherit pkgs;
        src = ./.;
        name = pname; # name of executable
        entry = "app.ts";

        # additional libraries and executables to add to gjs' runtime
        extraPackages = [
          ags.packages.${system}.hyprland
          ags.packages.${system}.tray
          ags.packages.${system}.network
          ags.packages.${system}.battery
          ags.packages.${system}.mpris
          ags.packages.${system}.wireplumber
          ags.packages.${system}.bluetooth
          pkgs.libgtop
          pkgs.libsoup_3
          # pkgs.fzf
        ];
      };
    });
  };
}
