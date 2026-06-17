declare var SRC: string;

declare module "inline:*" {
  const inlineContent: string;
  export default inlineContent;
}

declare module "*.scss" {
  const scssContent: string;
  export default scssContent;
}

declare module "*.blp" {
  const blueprintContent: string;
  export default blueprintContent;
}

declare module "*.css" {
  const cssContent: string;
  export default cssContent;
}
