export class Job {
    constructor({
      soknadsbrev = '',
      jobbutlysning = '',
      cv = '',
      sendt = false,
      sendtKlokka = '',
      lagtInn = '',
      frist = '',
      pros = '',
      cons = '',
      datoAvslag = '',
      datoVidere = '',
      evtSoknad = '',
      stillingOpprettet = ''
    } = {}) {
      this.soknadsbrev = soknadsbrev;
      this.jobbutlysning = jobbutlysning;
      this.cv = cv;
      this.sendt = sendt;
      this.sendtKlokka = sendtKlokka;
      this.lagtInn = lagtInn;
      this.frist = frist;
      this.pros = pros;
      this.cons = cons;
      this.datoAvslag = datoAvslag;
      this.datoVidere = datoVidere;
      this.evtSoknad = evtSoknad;
      this.stillingOpprettet = stillingOpprettet;
    }
  }