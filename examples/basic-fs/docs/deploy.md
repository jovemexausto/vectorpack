# Distribution memo

Packs are meant to be shared like binaries: pushed to a registry and pulled by consumers.

The default flow is:
- build the pack from a manifest
- push to a registry (public or private)
- pull by name and query locally or on-registry

The core user experience is "give me the knowledge pack" not "recreate the pipeline."
