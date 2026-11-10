import { ApiType, shopifyApiProject } from "@shopify/api-codegen-preset";
import type { IGraphQLConfig } from "graphql-config";

const config: IGraphQLConfig = {
  projects: {
    default: shopifyApiProject({
      apiType: ApiType.Admin,
      apiVersion: "2026-01",
      documents: ["./app/**/*.{js,ts,jsx,tsx}"],
      outputDir: "./app/types",
    }),
  },
};

export default config;
