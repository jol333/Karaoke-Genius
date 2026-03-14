import React from 'react';
import { STEPS, STEP_IDS } from '../constants';
import { AppStep } from '../types';

interface StepIndicatorProps {
  currentStep: AppStep;
  maxStep: number;
  onStepClick: (step: AppStep) => void;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, maxStep, onStepClick }) => {
  const activeIndex = STEP_IDS[currentStep];

  return (
    <div className="w-full max-w-3xl mx-auto mb-12 px-4">
      <div className="flex items-center justify-between relative">
        {/* Background Line */}
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-[1px] bg-zinc-800 -z-10"></div>
        
        {/* Active Progress Line */}
        <div 
            className="absolute left-0 top-1/2 transform -translate-y-1/2 h-[1px] bg-zinc-200 -z-10 transition-all duration-500 ease-out"
            style={{ width: `${((activeIndex - 1) / (STEPS.length - 1)) * 100}%` }}
        ></div>
        
        {STEPS.map((step) => {
          const isActive = step.id <= activeIndex;
          const isCurrent = step.id === activeIndex;
          const isClickable = step.id <= maxStep;

          return (
            <div 
                key={step.id} 
                className={`flex flex-col items-center group ${isClickable ? 'cursor-pointer' : 'cursor-default opacity-50'}`}
                onClick={() => {
                    if (isClickable) {
                        onStepClick(step.value);
                    }
                }}
            >
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs transition-all duration-300 border ${
                  isActive 
                    ? 'bg-zinc-100 border-zinc-100 text-black shadow-[0_0_15px_rgba(255,255,255,0.2)]' 
                    : isClickable 
                        ? 'bg-[#121212] border-zinc-500 text-zinc-300 hover:border-zinc-300' 
                        : 'bg-[#121212] border-zinc-800 text-zinc-700'
                }`}
              >
                {step.id}
              </div>
              <span className={`mt-3 text-[10px] uppercase tracking-wider font-semibold transition-colors duration-300 ${isCurrent ? 'text-zinc-200' : 'text-zinc-600'} hidden sm:block`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepIndicator;