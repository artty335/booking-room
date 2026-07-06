"use client";

import { createTheme } from "@mui/material/styles";

// Fixed light theme — colors never depend on the device's dark/light setting.
const theme = createTheme({
  colorSchemes: { light: true, dark: false },
  cssVariables: true,
  palette: {
    mode: "light",
    primary: {
      main: "#06c755",
      dark: "#05a548",
      contrastText: "#ffffff",
    },
    background: {
      default: "#f5f6f8",
      paper: "#ffffff",
    },
    text: {
      primary: "#1a1d21",
      secondary: "#6b7280",
    },
    divider: "#e6e8eb",
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
    button: { textTransform: "none", fontWeight: 500 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
  },
});

export default theme;
