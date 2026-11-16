# Stand-in architecture for the fitness scenarios

The layers block is the one scripts/check-fitness.ts compares with the atlas edges (FIT-4, FIT-5).

```yaml
layers:
  - { name: knowledge, path: knowledge/, may-depend-on: [] }
  - { name: core, path: core/, may-depend-on: [knowledge, agentic-sdlc] }
  - { name: agentic-sdlc, path: agentic-sdlc/, may-depend-on: [knowledge] }
```
