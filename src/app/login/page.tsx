import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { auth, signIn } from "@/auth";
import { ROOM_NAME } from "@/lib/booking-rules";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 3,
      }}
    >
      <Paper
        variant="outlined"
        sx={{ p: 4, maxWidth: 380, width: "100%", textAlign: "center", borderRadius: 4 }}
      >
        <Avatar
  variant="rounded"
  src="/205.png"
  alt="ห้องประชุม 205"
  sx={{
    width: 56,
    height: 56,
    mx: "auto",
    mb: 2,
  }}
/>
        <Typography sx={{ fontWeight: 600, fontSize: 18 }}>
          ระบบจอง{ROOM_NAME}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          เข้าสู่ระบบด้วยบัญชี LINE เพื่อจองห้องประชุม
        </Typography>
        <Box
          component="form"
          sx={{ mt: 3 }}
          action={async () => {
            "use server";
            await signIn("line", { redirectTo: "/" });
          }}
        >
          <Button type="submit" variant="contained" size="large" fullWidth>
            เข้าสู่ระบบด้วย LINE
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
