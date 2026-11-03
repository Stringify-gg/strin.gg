import "./style.css";
import { hydrate } from "nano-jsx/esm/index.js";
import { App } from "./App.tsx";

hydrate(<App />, document.getElementById("app")!);
