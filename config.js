const config = {
  // --- Core Settings ---
  totalPages: 292,
  imagePath: './images/Book_PHYS101_',
  thumbPath: './thumbs/Book_PHYS101_',

  // --- Security & API ---
  requireLogin: true, // Set to true to enable student ID login
  aiHelperProxyUrl: 'https://script.google.com/macros/s/AKfycbxzKK4RKp0rpCZcznOYPyV4aWMhBZLqYSn_ZFyNe3EO6_MxPWHZ3laF1QGL6zk6E4-h/exec',
  loginProxyUrl: 'https://script.google.com/macros/s/AKfycbwp-adP5rZLVHliN-oPPscoooixXb1xGrJTccnR6w8AmDAeV8UBQrycjSPpdXaiQwjRlQ/exec',
  
  // --- Content (Chapters are now loaded from chapters.json) ---
  chapters: [], 

  // Simulations
  simulations: [
    { 
      page: 9,  
      url: "https://phet.colorado.edu/sims/html/curve-fitting/latest/curve-fitting_all.html" 
    },
    { 
      page: 45, 
      url: "https://phet.colorado.edu/sims/html/masses-and-springs-basics/latest/masses-and-springs-basics_all.html"
    }
  ],
  
  // Videos
  videos: [
    {
      page: 10,
      url: "https://www.youtube.com/watch?v=JieVY0q1Ypg"
    },
    {
      page: 48,
      url: "https://youtu.be/eW5ICEtjN4w?si=u1JhfpFh-YZN8bT"
    },
    {
      page: 52,
    url: "https://youtu.be/x-UiYHyAUaM?si=9fDo4sMArhDzZdks"
    } 
  ]
};

