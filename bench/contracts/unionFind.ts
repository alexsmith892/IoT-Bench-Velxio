/**
 * Minimal Union-Find (disjoint set) — a trimmed copy of the net-merging core
 * of `frontend/src/simulation/spice/unionFind.ts`. Copied (rather than
 * imported) so the bench package stays decoupled from the frontend's
 * store-coupled module graph. Only `union` / `find` / `connected` are needed
 * to collapse wired pins into nets for LED-pin resolution.
 */
export class UnionFind {
  private parent = new Map<string, string>();

  private ensure(key: string): void {
    if (!this.parent.has(key)) this.parent.set(key, key);
  }

  find(key: string): string {
    this.ensure(key);
    while (this.parent.get(key) !== key) {
      const grandparent = this.parent.get(this.parent.get(key)!)!;
      this.parent.set(key, grandparent); // path compression
      key = grandparent;
    }
    return key;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }

  connected(a: string, b: string): boolean {
    return this.find(a) === this.find(b);
  }
}
