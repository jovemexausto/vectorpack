{
  description = "VectorPack dev shell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in {
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in {
          default = pkgs.mkShell {
            packages = [
              pkgs.nodejs_20
              pkgs.pnpm
              pkgs.rustc
              pkgs.cargo
              pkgs.pkg-config
              pkgs.openssl
            ];
            shellHook = ''
              echo "VectorPack dev shell (Nix)"
            '';
          };
        });
    };
}
