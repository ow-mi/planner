import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Target, Settings, XCircle, Calendar } from 'lucide-react';
import Slide from './Slide.jsx';
import BulletPoint from './BulletPoint.jsx';

const PVPresentation = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    // Slide 1: Overview
    <Slide key={0} title="PV Scenarios Considered" number={1} total={5}>
      <div className="max-w-4xl">
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-cyan-600 mb-6">Objective</h2>
          <BulletPoint icon={Target}>
            Form a planning estimation to allow for information on the optimal resource allocation for the project
          </BulletPoint>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-cyan-600 mb-6">Scenarios Evaluated</h2>
          <BulletPoint>
            Multiple resource allocations evaluated (Sofia & Hengelo)
          </BulletPoint>
          <BulletPoint>
            Each scenario includes variants <span className="font-semibold">with</span> and <span className="font-semibold">without DCCPDU 21a</span>
          </BulletPoint>
        </div>
      </div>
    </Slide>,

    // Slide 2: Key Assumptions
    <Slide key={1} title="Key Assumptions" number={2} total={5}>
      <div className="max-w-4xl">
        <BulletPoint>
          PV testing starts in <span className="font-semibold">CW36–2026</span>
        </BulletPoint>
        <BulletPoint>
          PV test specification closely aligns with <span className="font-semibold">DV spec</span>
        </BulletPoint>
        <BulletPoint>
          Test durations based on <span className="font-semibold">DV runtime data</span>
        </BulletPoint>
        <BulletPoint>
          Test buildup times included within testing durations
        </BulletPoint>
      </div>
    </Slide>,

    // Slide 3: Exclusions - Equipment
    <Slide key={2} title="Excluded from Test Durations" number={3} total={5}>
      <div className="max-w-4xl">
        <h2 className="text-2xl font-semibold text-cyan-600 mb-8">Equipment Setup & Preparation</h2>

        <BulletPoint icon={Settings}>
          Equipment setup and integration (engineering support tasks)
        </BulletPoint>

        <div className="ml-14 space-y-4 mb-6">
          <p className="text-lg text-slate-600">• Chamber/power supply/chiller setup</p>
          <p className="text-lg text-slate-600">• Preparation of consumables (HV headers, CAN cables, etc.)</p>
        </div>

        <BulletPoint icon={Settings}>
          Equipment and consumable lead times
        </BulletPoint>
      </div>
    </Slide>,

    // Slide 4: Exclusions - Operational
    <Slide key={3} title="Excluded from Test Durations" number={4} total={5}>
      <div className="max-w-4xl">
        <h2 className="text-2xl font-semibold text-cyan-600 mb-8">Operational Constraints</h2>

        <BulletPoint icon={XCircle}>
          Downtime from equipment issues or unplanned FTE unavailability
        </BulletPoint>

        <BulletPoint icon={XCircle}>
          Rework and analysis of box-level issues
        </BulletPoint>
      </div>
    </Slide>,

    // Slide 5: Solver Parameters
    <Slide key={4} title="Scheduling Parameters" number={5} total={5}>
      <div className="max-w-4xl">
        <BulletPoint icon={Calendar}>
          <span className="font-semibold">Holidays:</span> 2 weeks in winter, 3 weeks in summer
        </BulletPoint>

        <BulletPoint icon={Settings}>
          FTE and equipment can only work on <span className="font-semibold">one test at a time</span>
        </BulletPoint>

        <BulletPoint icon={Settings}>
          <span className="font-semibold">4 DUTs per chamber</span> maximum — tests with more DUTs must be duplicated
        </BulletPoint>

        <BulletPoint icon={Target}>
          Solver objective: Finish the program <span className="font-semibold">as quickly as possible</span>
        </BulletPoint>
      </div>
    </Slide>
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  return (
    <div className="w-full h-screen bg-slate-900 flex items-center justify-center">
      <div className="relative w-full max-w-7xl aspect-[16/9] bg-white rounded-lg shadow-2xl overflow-hidden">
        {slides[currentSlide]}

        {/* Navigation */}
        <button
          onClick={prevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-all"
          disabled={currentSlide === 0}
        >
          <ChevronLeft className={`w-6 h-6 ${currentSlide === 0 ? 'text-slate-300' : 'text-slate-700'}`} />
        </button>

        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-all"
          disabled={currentSlide === slides.length - 1}
        >
          <ChevronRight className={`w-6 h-6 ${currentSlide === slides.length - 1 ? 'text-slate-300' : 'text-slate-700'}`} />
        </button>

        {/* Slide indicators */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentSlide ? 'bg-cyan-500 w-8' : 'bg-slate-300'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default PVPresentation;
