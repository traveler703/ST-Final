import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const ignored = [
  ".next/**",
  "node_modules/**",
  "next-env.d.ts"
];

const config = [
  { ignores: ignored },
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off"
    }
  }
];

export default config;
