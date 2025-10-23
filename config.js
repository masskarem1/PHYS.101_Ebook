// ---------- Config ----------
const config = {
  requireLogin: false, // student login by id (true or false)
  totalPages: 292,
  imagePath: './images/Book_PHYS101_',
  thumbPath: './thumbs/Book_PHYS101_',
  imageExt: '.png',  // <-- added for clarity
  thumbExt: '.jpg',  // <-- fix this since your thumbs are JPGs

  chapters: [
    { title: "CHAPTER 1 – Physics and Measurements", page: 9 },
    { title: "CHAPTER 2 – Solids and Elasticity", page: 41 },
    { title: "CHAPTER 3 – Fluids", page: 63 },
    { title: "CHAPTER 4 – Thermal Physics", page: 135 },
    { title: "CHAPTER 5 – Waves and Sound", page: 217 },
    { title: "APPENDIX", page: 279 }
  ],

  // ---------- Simulation Config ----------
  simulations: [
    { page: 9, url: "https://phet.colorado.edu/sims/html/curve-fitting/latest/curve-fitting_all.html" },
    { page: 45, url: "https://phet.colorado.edu/sims/html/masses-and-springs-basics/latest/masses-and-springs-basics_all.html" }
  ],

  // ---------- Video Config ----------
  videos: [
    { page: 10, url: "https://www.youtube.com/watch?v=JieVY0q1Ypg" },
    { page: 48, url: "https://youtube.com/shorts/-H4oOfKtPDw?si=Jv94nlu73WhiL7M1" }
  ]
};
