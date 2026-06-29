export function shouldHideFileTabs(hideWhenSingle: boolean, openFileCount: number): boolean {
  return hideWhenSingle && openFileCount <= 1;
}
