import { redirect } from "next/navigation";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";
import { auth } from "@/auth";
import { BookingCalendar } from "@/components/booking-calendar";
import { SignOutButton } from "@/components/sign-out-button";
import { ROOM_NAME } from "@/lib/booking-rules";

export default async function Home() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <AppBar
        position="static"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}
      >
        <Container maxWidth="md" disableGutters>
          <Toolbar sx={{ gap: 1.5 }}>
            <Avatar alt="205" src="/205.png" />
            <Box sx={{ flexGrow: 1, lineHeight: 1.1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 15, lineHeight: 1.2 }}>
                {ROOM_NAME}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ระบบจองห้องประชุม
              </Typography>
            </Box>
            {session.user.image && (
              <Avatar src={session.user.image} sx={{ width: 32, height: 32 }} />
            )}
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: { xs: "none", sm: "block" } }}
            >
              {session.user.name}
            </Typography>
            <SignOutButton />
          </Toolbar>
        </Container>
      </AppBar>
      <Container maxWidth="md" disableGutters sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <BookingCalendar
          currentUserId={session.user.id}
          isAdmin={session.user.role === "ADMIN"}
        />
      </Container>
    </Box>
  );
}
