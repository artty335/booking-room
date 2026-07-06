"use client";

import Button from "@mui/material/Button";
import LogoutIcon from "@mui/icons-material/Logout";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <Button
      size="small"
      color="inherit"
      variant="outlined"
      startIcon={<LogoutIcon />}
      onClick={() => signOut({ redirectTo: "/login" })}
      sx={{ color: "text.secondary", borderColor: "divider" }}
    >
      ออกจากระบบ
    </Button>
  );
}
