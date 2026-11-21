import Header from '@/components/Header';

const HomeScreen = () => {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-mobile flex-col bg-bg-app">
      <Header isLive={false} />
    </main>
  );
};

export default HomeScreen;
