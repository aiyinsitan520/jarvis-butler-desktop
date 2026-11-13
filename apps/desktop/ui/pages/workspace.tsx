import React from "react";
import { createRoot } from "react-dom/client";
import "../lib/look";
import "../styles/tokens.css";
import "../knowledge/index.css";
import "../styles/workspace.css";
import { App } from "../knowledge/App";
createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);
