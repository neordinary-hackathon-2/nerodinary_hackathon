import Header from '@/components/Header';
import Remote from '@/components/Remote';

const HomeScreen = () => {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-mobile flex-col bg-bg-app">
      <Header isLive={false} />
      <div className="mt-6 flex justify-center">
        <Remote />
      </div>
    </main>
  );
};

export default HomeScreen;
