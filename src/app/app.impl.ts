import { PixiApplication, IPixiApplicationOptions } from '../plugins/engine';
import { ApplicationInterface, StageInterface, PanelInterface, TickerInterface, RendererInterface } from '../entities/manager';

export class App implements ApplicationInterface {
    private _app: PixiApplication;
    ticker?: TickerInterface;
    stage?: StageInterface;
    renderer?: RendererInterface;
    panel: PanelInterface;

    constructor() {
        // create application
        this._app = new PixiApplication();

        // set pixi panel
        const pixiPanel: PanelInterface = {
            resize: (fn: () => void) => {
                window.addEventListener("resize", fn);
            }
        }
        this.panel = pixiPanel;
    };

    public async init<T = Partial<IPixiApplicationOptions>>(options: T): Promise<void> {
        await this._app.init(options!);

        // set stage, ticker, and renderer
        this.ticker = this._app.ticker;
        this.stage = this._app.stage;
        this.renderer = this._app.renderer;
    };
}