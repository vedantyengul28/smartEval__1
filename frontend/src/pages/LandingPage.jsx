import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-slate-900">SmartEval</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/login" className="text-slate-600 hover:text-slate-900 font-medium">Login</Link>
              <Link to="/register" className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 font-medium">Register</Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-slate-900 mb-6">
            AI-Assisted Answer Evaluation System
          </h1>
          <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
            Streamline your examination evaluation process with advanced AI technology. 
            SmartEval combines OCR, semantic analysis, and intelligent marking to provide 
            accurate, efficient, and fair assessment of student answers.
          </p>
          <div className="flex justify-center gap-4">
            <Link to="/register" className="bg-brand-600 text-white px-8 py-3 rounded-lg hover:bg-brand-700 font-semibold text-lg">
              Get Started
            </Link>
            <Link to="/login" className="bg-white text-slate-900 px-8 py-3 rounded-lg border border-slate-300 hover:bg-slate-50 font-semibold text-lg">
              Login
            </Link>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
            <div className="w-12 h-12 bg-brand-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Handwritten Answer Processing</h3>
            <p className="text-slate-600">
              Advanced OCR technology extracts text from handwritten answer sheets with high accuracy, 
              supporting multiple file formats including PDF, PNG, JPG, and JPEG.
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
            <div className="w-12 h-12 bg-brand-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">AI-Powered Evaluation</h3>
            <p className="text-slate-600">
              Semantic analysis using SBERT compares student answers with model answers, 
              providing intelligent mark suggestions with confidence scores and detailed feedback.
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
            <div className="w-12 h-12 bg-brand-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Faculty Review & Approval</h3>
            <p className="text-slate-600">
              Teachers have complete control over the evaluation process. Review AI suggestions, 
              modify marks, add feedback, and approve final results before releasing to students.
            </p>
          </div>
        </div>

        <div className="mt-20 bg-white rounded-xl shadow-sm border border-slate-200 p-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="text-center">
              <div className="w-10 h-10 bg-brand-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 font-bold">1</div>
              <h4 className="font-semibold text-slate-900 mb-2">Create Assessment</h4>
              <p className="text-sm text-slate-600">Teachers create exams with questions and model answers</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-brand-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 font-bold">2</div>
              <h4 className="font-semibold text-slate-900 mb-2">Student Submission</h4>
              <p className="text-sm text-slate-600">Students submit handwritten or typed answers</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-brand-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 font-bold">3</div>
              <h4 className="font-semibold text-slate-900 mb-2">OCR Processing</h4>
              <p className="text-sm text-slate-600">System extracts text from handwritten answers</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-brand-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 font-bold">4</div>
              <h4 className="font-semibold text-slate-900 mb-2">AI Evaluation</h4>
              <p className="text-sm text-slate-600">AI analyzes answers and suggests marks</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-brand-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 font-bold">5</div>
              <h4 className="font-semibold text-slate-900 mb-2">Faculty Approval</h4>
              <p className="text-sm text-slate-600">Teachers review and approve final results</p>
            </div>
          </div>
        </div>

        <div className="mt-20 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Ready to Transform Your Evaluation Process?</h2>
          <p className="text-slate-600 mb-8">Join SmartEval today and experience the future of automated answer evaluation.</p>
          <Link to="/register" className="bg-brand-600 text-white px-8 py-3 rounded-lg hover:bg-brand-700 font-semibold text-lg">
            Create Account
          </Link>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-slate-600">
            <p>&copy; 2024 SmartEval. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
