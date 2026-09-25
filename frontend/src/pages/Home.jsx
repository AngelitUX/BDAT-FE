import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import HumanModel from '../components/HumanModel';

const Home = () => {
  const navigate = useNavigate();
  const runSimulation = () => navigate('/simulations', { state: { showTransition: true } });

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-900 overflow-x-hidden flex items-center">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[56rem] h-[56rem] bg-indigo-200/40 blur-[140px]" />
        <div className="absolute top-72 right-0 w-[28rem] h-[28rem] bg-cyan-200/40 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-10 w-full">
        <section className="grid lg:grid-cols-2 gap-10 items-center pt-12 pb-12">
          <div className="space-y-5">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-tight max-w-xl">
              Bone Densitometry Analysis Platform
            </h1>
            <p className="text-slate-600 max-w-lg leading-relaxed">
              Simulate and analyze ultrasonic wave propagation in cortical bone using advanced 2D computational mechanics. Configure multi-layered biological models, fine-tune material porosities, and visualize high-fidelity results.
            </p>
            <button
              onClick={runSimulation}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 px-6 py-3 font-medium transition"
            >
              Launch platform
              <ArrowRight className="w-4 h-4" />
            </button>
            <div className="pt-2 flex flex-wrap gap-5 text-slate-600 text-sm">
              <span className="inline-flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                Clear layout
              </span>
              <span className="inline-flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                3D-first navigation
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-r from-indigo-200/60 to-cyan-200/60 blur-xl opacity-80" />
            <div className="relative h-[460px] rounded-[2rem] border border-slate-200 bg-transparent overflow-hidden">
              <HumanModel />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Home;
