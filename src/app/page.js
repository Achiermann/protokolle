import ClientWrapper from './components/ClientWrapper';

// `/` is Protokolle; `/?app=f` opens Finanzen. Booking lives at /booking.
export default async function Home({ searchParams }) {
  const { app } = await searchParams;
  return <ClientWrapper initialApp={app === 'f' ? 'f' : 'p'} />;
}
