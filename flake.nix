{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
    ags.url = "github:aylur/ags";
  };

  outputs = { self, nixpkgs, ags }: let
    system = "x86_64-linux";
    pkgs = nixpkgs.legacyPackages.${system};
  in {

    # Dev environment
    devShells.${system}.default = pkgs.mkShell {
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
          ];
        })
      ];
    };

    # Package
    packages.${system}.default = ags.lib.bundle { 
      inherit pkgs;
      src = ./.;
      name = "trevbar"; # name of executable
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
        # pkgs.fzf
      ];
    };
  };
}