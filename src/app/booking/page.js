import ClientWrapper from '../components/ClientWrapper';

// Entry point of the standalone Booking PWA: same app, locked to Booking.
export default function BookingPage() {
  return <ClientWrapper lockedApp="b" />;
}
