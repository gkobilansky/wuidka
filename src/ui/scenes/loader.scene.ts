import { PixiContainer } from "../../plugins/engine";
import { Manager, SceneInterface } from "../../entities/manager";
import { LoadingBarContainer } from "../containers/loading-bar.container";

export class LoaderScene extends PixiContainer implements SceneInterface {

    private _loadingBar: LoadingBarContainer;
    constructor() {
        super();
        const parentWidth = Manager.width;
        const parentHeight = Manager.height;

        const loaderBarWidth = 400;
        this._loadingBar = new LoadingBarContainer(loaderBarWidth, parentWidth, parentHeight);
        this.addChild(this._loadingBar);
    }

    update(_framesPassed: number): void {}

    progressCallback(progress: number): void {
        this._loadingBar.scaleProgress(progress);
    }

    resize(screenWidth: number, screenHeight: number): void { 
        this.width = screenWidth; 
        this.height = screenHeight; 
        this._loadingBar.resize(screenWidth, screenHeight);
    }
}
